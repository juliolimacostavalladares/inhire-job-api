import { Injectable, Inject } from '@nestjs/common';
import { CRAWL_RUNS_REPOSITORY, CrawlRunsRepository } from '../ports/crawl-runs.repository';
import { TENANTS_REPOSITORY, TenantsRepository } from '../../../catalog/application/ports/tenants.repository';
import { JOB_COLLECTOR_CLIENT, JobCollectorClient } from '../ports/job-collector.client';
import {
  JOB_PROFILE_AI_MATCHER,
  JobProfileAiMatcher,
} from '../ports/job-profile-ai-matcher.port';
import { CATALOG_SERVICE, CatalogService } from '../../../catalog/application/ports/catalog-service.interface';
import { CrawlRun } from '../../domain/crawl-run.entity';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

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
    let tenants = (await this.tenantsRepo.findAll({ isActive: true, limit: 5000 })).items;
    const cleanTenantId = tenantId?.trim();
    if (cleanTenantId && cleanTenantId.toLowerCase() !== 'all') {
      tenants = tenants.filter((t) => t.id === cleanTenantId || t.slug.toLowerCase() === cleanTenantId.toLowerCase());
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
        'collect-jobs',
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
    @Inject(JOB_PROFILE_AI_MATCHER) private readonly aiMatcher: JobProfileAiMatcher,
    @Inject(CATALOG_SERVICE) private readonly catalogService: CatalogService,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
    private readonly prisma: PrismaService,
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

      // Leitura dinâmica dos perfis de candidatos e políticas cadastradas no sistema
      const profiles = await this.prisma.candidateProfile.findMany({
        select: {
          headline: true,
          skills: true,
          experiences: true,
        },
      });

      const policies = await this.prisma.autoApplyPolicy.findMany({
        select: {
          targetRoles: true,
          targetLocations: true,
        },
      });

      const hasCandidateCriteria =
        profiles.some((p) => p.headline || (p.skills && p.skills.length > 0)) ||
        policies.some((pol) => pol.targetRoles && pol.targetRoles.length > 0);

      const observedExternalIds: string[] = [];
      let savedJobsCount = 0;

      for (const jobData of collection.jobs) {
        let isRelevant = !hasCandidateCriteria;

        if (hasCandidateCriteria) {
          // Avaliação inteligente com Inteligência Artificial para cada perfil de candidato
          for (const p of profiles) {
            const aiResult = await this.aiMatcher.evaluateMatch(
              {
                headline: p.headline,
                skills: p.skills || [],
                experiences: (p.experiences as Array<{ role?: string; company?: string; description?: string }>) || [],
              },
              {
                title: jobData.title,
                description: jobData.description,
                location: jobData.location,
              },
            );

            if (aiResult.isMatch) {
              isRelevant = true;
              break;
            }
          }

          if (!isRelevant) {
            for (const pol of policies) {
              const aiResult = await this.aiMatcher.evaluateMatch(
                {
                  skills: [],
                  targetRoles: pol.targetRoles || [],
                },
                {
                  title: jobData.title,
                  description: jobData.description,
                  location: jobData.location,
                },
              );

              if (aiResult.isMatch) {
                isRelevant = true;
                break;
              }
            }
          }
        }

        // Salva apenas as vagas que a Inteligência Artificial aprovou como compatíveis com o perfil
        if (isRelevant) {
          observedExternalIds.push(jobData.externalId);
          savedJobsCount++;
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
      }

      // Conclusive collection updates active jobs for observed tenant
      if (collection.isConclusive) {
        await this.catalogService.closeMissingJobs(tenant.id, observedExternalIds);
      }

      await this.runsRepo.addItem({
        id: this.idGenerator.generate(),
        runId,
        tenantId,
        status: 'SUCCEEDED',
        jobsCollected: savedJobsCount,
        createdAt: this.clock.now(),
      });

      run.recordTenantResult('SUCCEEDED', savedJobsCount, this.clock.now());
      await this.runsRepo.save(run);
    } catch (err: unknown) {
      const error = err as Error;
      await this.runsRepo.addItem({
        id: this.idGenerator.generate(),
        runId,
        tenantId,
        status: 'FAILED',
        jobsCollected: 0,
        errorCode: 'COLLECTION_EXCEPTION',
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

  async execute(filters: { type?: string; status?: string; page?: number; limit?: number }) {
    return this.runsRepo.findAll(filters);
  }
}

@Injectable()
export class GetRunUseCase {
  constructor(@Inject(CRAWL_RUNS_REPOSITORY) private readonly runsRepo: CrawlRunsRepository) {}

  async execute(id: string) {
    const run = await this.runsRepo.findById(id);
    if (!run) {
      throw new Error(`Run ${id} not found`);
    }
    return run;
  }
}
