import { Injectable, Inject } from '@nestjs/common';
import { CRAWL_RUNS_REPOSITORY, CrawlRunsRepository } from '../ports/crawl-runs.repository';
import { JOB_COLLECTOR_CLIENT, JobCollectorClient } from '../ports/job-collector.client';
import { CATALOG_SERVICE, CatalogService } from '../../../catalog/application/ports/catalog-service.interface';
import { TENANTS_REPOSITORY, TenantsRepository } from '../../../catalog/application/ports/tenants.repository';
import { CrawlRun } from '../../domain/crawl-run.entity';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { AppError } from '@shared/domain/errors/app-error';

@Injectable()
export class CreateDiscoveryRunUseCase {
  constructor(
    @Inject(CRAWL_RUNS_REPOSITORY) private readonly runsRepo: CrawlRunsRepository,
    private readonly bullmqService: BullMQService,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
  ) {}

  async execute(trigger: 'SCHEDULED' | 'ADMIN_MANUAL' = 'ADMIN_MANUAL', correlationId?: string): Promise<{ runId: string; status: string }> {
    const runId = this.idGenerator.generate();
    const run = CrawlRun.create({
      id: runId,
      type: 'DISCOVERY',
      trigger,
      totalTenants: 1,
      now: this.clock.now(),
    });

    await this.runsRepo.save(run);

    await this.bullmqService.addJob(
      'tenant-discovery',
      'discover-tenants',
      { runId, correlationId },
      `discovery:${runId}`,
    );

    return { runId, status: 'RUNNING' };
  }
}

@Injectable()
export class CreateCollectionRunUseCase {
  constructor(
    @Inject(CRAWL_RUNS_REPOSITORY) private readonly runsRepo: CrawlRunsRepository,
    @Inject(TENANTS_REPOSITORY) private readonly tenantsRepo: TenantsRepository,
    private readonly bullmqService: BullMQService,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
  ) {}

  async execute(trigger: 'SCHEDULED' | 'ADMIN_MANUAL' = 'ADMIN_MANUAL', tenantId?: string, correlationId?: string): Promise<{ runId: string; status: string; totalTenants: number }> {
    let tenants = (await this.tenantsRepo.findAll({ isActive: true, limit: 1000 })).items;
    if (tenantId) {
      tenants = tenants.filter((t) => t.id === tenantId || t.slug === tenantId);
    }

    const runId = this.idGenerator.generate();
    const run = CrawlRun.create({
      id: runId,
      type: 'COLLECTION',
      trigger,
      totalTenants: tenants.length,
      now: this.clock.now(),
    });

    await this.runsRepo.save(run);

    for (const tenant of tenants) {
      await this.bullmqService.addJob(
        'job-collection',
        'collect-tenant-jobs',
        { runId, tenantId: tenant.id, correlationId },
        `collection:${runId}:${tenant.id}`,
      );
    }

    return { runId, status: 'RUNNING', totalTenants: tenants.length };
  }
}

@Injectable()
export class ProcessTenantDiscoveryUseCase {
  constructor(
    @Inject(CRAWL_RUNS_REPOSITORY) private readonly runsRepo: CrawlRunsRepository,
    @Inject(JOB_COLLECTOR_CLIENT) private readonly collectorClient: JobCollectorClient,
    @Inject(CATALOG_SERVICE) private readonly catalogService: CatalogService,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
    private readonly logger: SanitizedLogger,
  ) {}

  async execute(runId: string): Promise<void> {
    const run = await this.runsRepo.findById(runId);
    if (!run) return;

    try {
      const discovered = await this.collectorClient.discoverPublicTenants();
      for (const t of discovered) {
        await this.catalogService.upsertTenant(t);
      }
      run.recordTenantResult('SUCCEEDED', discovered.length, this.clock.now());
      await this.runsRepo.save(run);
    } catch (err: unknown) {
      const error = err as Error;
      run.fail('DISCOVERY_FAILED', error.message, this.clock.now());
      await this.runsRepo.save(run);
      throw err;
    }
  }
}

@Injectable()
export class ProcessJobCollectionUseCase {
  constructor(
    @Inject(CRAWL_RUNS_REPOSITORY) private readonly runsRepo: CrawlRunsRepository,
    @Inject(TENANTS_REPOSITORY) private readonly tenantsRepo: TenantsRepository,
    @Inject(JOB_COLLECTOR_CLIENT) private readonly collectorClient: JobCollectorClient,
    @Inject(CATALOG_SERVICE) private readonly catalogService: CatalogService,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
    private readonly logger: SanitizedLogger,
  ) {}

  async execute(runId: string, tenantId: string): Promise<void> {
    const run = await this.runsRepo.findById(runId);
    if (!run) return;

    const tenant = await this.tenantsRepo.findById(tenantId);
    if (!tenant) return;

    try {
      const collection = await this.collectorClient.collectFromTenant(tenant.officialUrl);

      if (collection.error) {
        // CAT-AC-03: Coleta parcial NÃO fecha vagas sem evidência!
        await this.runsRepo.addItem({
          id: this.idGenerator.generate(),
          runId,
          tenantId,
          status: 'FAILED',
          jobsCollected: 0,
          errorCode: 'COLLECTION_ERROR',
          errorMessage: collection.error,
          createdAt: this.clock.now(),
        });
        run.recordTenantResult('FAILED', 0, this.clock.now());
        await this.runsRepo.save(run);
        return;
      }

      const observedExternalIds: string[] = [];
      for (const jobData of collection.jobs) {
        observedExternalIds.push(jobData.externalId);
        await this.catalogService.upsertJob({
          tenantId: tenant.id,
          externalId: jobData.externalId,
          title: jobData.title,
          url: jobData.url, // Canonical URL
          description: jobData.description,
          location: jobData.location,
          formSchema: jobData.formSchema,
        });
      }

      // Only close missing jobs if collection was completely conclusive
      if (collection.isConclusive) {
        await this.catalogService.closeMissingJobs(tenant.id, observedExternalIds);
      }

      await this.runsRepo.addItem({
        id: this.idGenerator.generate(),
        runId,
        tenantId,
        status: 'SUCCEEDED',
        jobsCollected: collection.jobs.length,
        createdAt: this.clock.now(),
      });

      run.recordTenantResult('SUCCEEDED', collection.jobs.length, this.clock.now());
      await this.runsRepo.save(run);
    } catch (err: unknown) {
      const error = err as Error;
      await this.runsRepo.addItem({
        id: this.idGenerator.generate(),
        runId,
        tenantId,
        status: 'FAILED',
        jobsCollected: 0,
        errorCode: 'UNEXPECTED_COLLECTION_ERROR',
        errorMessage: error.message,
        createdAt: this.clock.now(),
      });
      run.recordTenantResult('FAILED', 0, this.clock.now());
      await this.runsRepo.save(run);
      throw err;
    }
  }
}

@Injectable()
export class ListRunsUseCase {
  constructor(@Inject(CRAWL_RUNS_REPOSITORY) private readonly runsRepo: CrawlRunsRepository) {}

  async execute(filter?: { type?: string; status?: string; page?: number; limit?: number }) {
    return this.runsRepo.findAll(filter);
  }
}

@Injectable()
export class GetRunUseCase {
  constructor(@Inject(CRAWL_RUNS_REPOSITORY) private readonly runsRepo: CrawlRunsRepository) {}

  async execute(runId: string): Promise<CrawlRun> {
    const run = await this.runsRepo.findById(runId);
    if (!run) {
      throw AppError.notFound(`Crawl run ${runId} not found`);
    }
    return run;
  }
}
