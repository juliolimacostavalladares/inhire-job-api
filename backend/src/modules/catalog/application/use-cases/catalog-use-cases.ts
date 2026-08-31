import { Injectable, Inject, Optional } from '@nestjs/common';
import { JOBS_REPOSITORY, JobsRepository, FindJobsFilter } from '../ports/jobs.repository';
import { TENANTS_REPOSITORY, TenantsRepository } from '../ports/tenants.repository';
import { Job, JobSnapshot, FormFieldSchema } from '../../domain/job.entity';
import { Tenant } from '../../domain/tenant.entity';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { AppError } from '@shared/domain/errors/app-error';

export interface ExtendedFindJobsFilter extends FindJobsFilter {
  tenantSlug?: string;
}

@Injectable()
export class ListJobsUseCase {
  constructor(
    @Inject(JOBS_REPOSITORY) private readonly jobsRepo: JobsRepository,
    @Optional() @Inject(TENANTS_REPOSITORY) private readonly tenantsRepo?: TenantsRepository,
  ) {}

  async execute(filter?: ExtendedFindJobsFilter): Promise<{ items: Job[]; total: number }> {
    let targetTenantId = filter?.tenantId;
    if (!targetTenantId && filter?.tenantSlug && this.tenantsRepo) {
      const tenant = await this.tenantsRepo.findBySlug(filter.tenantSlug);
      if (tenant) {
        targetTenantId = tenant.id;
      }
    }

    return this.jobsRepo.findAll({
      ...filter,
      tenantId: targetTenantId,
    });
  }
}

@Injectable()
export class GetJobUseCase {
  constructor(@Inject(JOBS_REPOSITORY) private readonly jobsRepo: JobsRepository) {}

  async execute(id: string): Promise<Job> {
    const job = await this.jobsRepo.findById(id);
    if (!job) {
      throw AppError.notFound(`Job with ID ${id} not found`);
    }
    return job;
  }
}

@Injectable()
export class GetApplicationFormUseCase {
  constructor(private readonly getJobUseCase: GetJobUseCase) {}

  async execute(jobId: string): Promise<FormFieldSchema[]> {
    const job = await this.getJobUseCase.execute(jobId);
    return job.formSchema;
  }
}

@Injectable()
export class GetApplicationSnapshotUseCase {
  constructor(private readonly getJobUseCase: GetJobUseCase) {}

  async execute(jobId: string): Promise<JobSnapshot> {
    const job = await this.getJobUseCase.execute(jobId);
    if (job.status !== 'PUBLISHED') {
      throw AppError.jobNotPublished(`Job ${jobId} is closed or not published`);
    }
    return job.toSnapshot();
  }
}

@Injectable()
export class UpsertTenantUseCase {
  constructor(
    @Inject(TENANTS_REPOSITORY) private readonly tenantsRepo: TenantsRepository,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
  ) {}

  async execute(data: { slug: string; name: string; officialUrl: string; isActive?: boolean }): Promise<Tenant> {
    const slug = data.slug.trim().toLowerCase();
    let tenant = await this.tenantsRepo.findBySlug(slug);
    const now = this.clock.now();

    if (!tenant) {
      tenant = Tenant.create({
        id: this.idGenerator.generate(),
        slug,
        name: data.name,
        officialUrl: data.officialUrl,
        isActive: data.isActive ?? true,
        now,
      });
    } else {
      tenant.update({
        name: data.name,
        officialUrl: data.officialUrl,
        isActive: data.isActive,
        now,
      });
    }

    return this.tenantsRepo.save(tenant);
  }
}

@Injectable()
export class UpsertJobUseCase {
  constructor(
    @Inject(JOBS_REPOSITORY) private readonly jobsRepo: JobsRepository,
    @Inject(TENANTS_REPOSITORY) private readonly tenantsRepo: TenantsRepository,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
  ) {}

  async execute(data: {
    tenantId: string;
    externalId: string;
    title: string;
    url: string;
    description: string;
    location?: string;
    workplaceType?: string;
    contractType?: string;
    tags?: string[];
    formSchema?: FormFieldSchema[];
  }): Promise<Job> {
    const tenant = await this.tenantsRepo.findById(data.tenantId);
    if (!tenant) {
      throw AppError.notFound(`Tenant ${data.tenantId} not found`);
    }

    let job = await this.jobsRepo.findByTenantAndExternalId(data.tenantId, data.externalId);
    const now = this.clock.now();

    if (!job) {
      job = Job.create({
        id: this.idGenerator.generate(),
        tenantId: data.tenantId,
        externalId: data.externalId,
        title: data.title,
        url: data.url, // Canonical URL
        description: data.description,
        location: data.location,
        workplaceType: data.workplaceType,
        contractType: data.contractType,
        tags: data.tags,
        formSchema: data.formSchema,
        now,
      });
    } else {
      job.update({
        title: data.title,
        description: data.description,
        location: data.location,
        workplaceType: data.workplaceType,
        contractType: data.contractType,
        tags: data.tags,
        formSchema: data.formSchema,
        status: 'PUBLISHED',
        now,
      });
    }

    return this.jobsRepo.save(job);
  }
}

@Injectable()
export class CloseMissingJobsUseCase {
  constructor(
    @Inject(JOBS_REPOSITORY) private readonly jobsRepo: JobsRepository,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
  ) {}

  async execute(tenantId: string, observedExternalIds: string[]): Promise<number> {
    const existingJobs = await this.jobsRepo.findByTenantId(tenantId);
    const observedSet = new Set(observedExternalIds);
    let closedCount = 0;
    const now = this.clock.now();

    for (const job of existingJobs) {
      if (job.status === 'PUBLISHED' && !observedSet.has(job.externalId)) {
        job.close(now);
        await this.jobsRepo.save(job);
        closedCount++;
      }
    }

    return closedCount;
  }
}

@Injectable()
export class ListTenantsUseCase {
  constructor(@Inject(TENANTS_REPOSITORY) private readonly tenantsRepo: TenantsRepository) {}

  async execute(filter?: { isActive?: boolean; search?: string; page?: number; limit?: number }): Promise<{ items: Tenant[]; total: number }> {
    return this.tenantsRepo.findAll(filter);
  }
}

@Injectable()
export class GetTenantUseCase {
  constructor(@Inject(TENANTS_REPOSITORY) private readonly tenantsRepo: TenantsRepository) {}

  async execute(idOrSlug: string): Promise<Tenant> {
    let tenant = await this.tenantsRepo.findById(idOrSlug);
    if (!tenant) {
      tenant = await this.tenantsRepo.findBySlug(idOrSlug.toLowerCase());
    }
    if (!tenant) {
      throw AppError.notFound(`Tenant ${idOrSlug} not found`);
    }
    return tenant;
  }
}
