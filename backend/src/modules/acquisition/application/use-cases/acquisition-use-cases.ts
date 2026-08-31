import { Injectable, Inject } from '@nestjs/common';
import { CRAWL_RUNS_REPOSITORY, CrawlRunsRepository } from '../ports/crawl-runs.repository';
import { TENANTS_REPOSITORY } from '../../../catalog/application/ports/tenants.repository';
import { TenantsRepository } from '../../../catalog/application/ports/tenants.repository';
import { JOB_COLLECTOR_CLIENT, JobCollectorClient } from '../ports/job-collector.client';
import { CATALOG_SERVICE, CatalogService } from '../../../catalog/application/ports/catalog-service.interface';
import { CrawlRun } from '../../domain/crawl-run.entity';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

const STOP_WORDS = new Set([
  'de', 'da', 'do', 'dos', 'das', 'em', 'para', 'com', 'sem', 'por', 'que', 'como',
  'senior', 'sênior', 'pleno', 'junior', 'júnior', 'lead', 'staff', 'principal',
  'especialista', 'analista', 'gerente', 'coordenador', 'pessoa', 'vaga', 'oportunidade',
]);

function textMatchesTerms(text: string, terms: string[]): boolean {
  const combined = text.toLowerCase();
  return terms.some((term) => {
    const cleanTerm = term.toLowerCase().trim();
    if (!cleanTerm) return false;
    // Direct substring match
    if (combined.includes(cleanTerm)) return true;
    
    // Substantive domain words match (excluding generic role prefixes/seniority)
    const substantiveWords = cleanTerm
      .split(/[\s/\\,\-]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    return substantiveWords.length > 0 && substantiveWords.some((w) => combined.includes(w));
  });
}

function textMatchesSkills(text: string, skills: string[]): boolean {
  const combined = text.toLowerCase();
  return skills.some((skill) => {
    const cleanSkill = skill.toLowerCase().trim();
    if (!cleanSkill) return false;
    return combined.includes(cleanSkill);
  });
}

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
          const jobText = `${jobData.title} ${jobData.description}`;

          // Match contra os perfis dos candidatos
          for (const p of profiles) {
            if (p.headline && textMatchesTerms(jobText, [p.headline])) {
              isRelevant = true;
              break;
            }
            if (p.skills && p.skills.length > 0 && textMatchesSkills(jobText, p.skills)) {
              isRelevant = true;
              break;
            }
            if (p.experiences && Array.isArray(p.experiences)) {
              const roles = (p.experiences as Array<{ role?: string }>).map((e) => e.role).filter(Boolean) as string[];
              if (roles.length > 0 && textMatchesTerms(jobText, roles)) {
                isRelevant = true;
                break;
              }
            }
          }

          // Match contra as políticas de auto-apply do candidato
          if (!isRelevant) {
            for (const pol of policies) {
              if (pol.targetRoles && pol.targetRoles.length > 0 && textMatchesTerms(jobText, pol.targetRoles)) {
                isRelevant = true;
                break;
              }
            }
          }
        }

        // Salva apenas as vagas que fazem sentido com o perfil do candidato
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
