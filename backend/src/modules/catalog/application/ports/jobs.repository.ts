import { Job } from '../../domain/job.entity';

export interface FindJobsFilter {
  tenantId?: string;
  status?: 'PUBLISHED' | 'CLOSED';
  search?: string;
  page?: number;
  limit?: number;
}

export interface JobsRepository {
  findById(id: string): Promise<Job | null>;
  findByTenantAndExternalId(tenantId: string, externalId: string): Promise<Job | null>;
  findAll(filter?: FindJobsFilter): Promise<{ items: Job[]; total: number }>;
  findByTenantId(tenantId: string): Promise<Job[]>;
  save(job: Job): Promise<Job>;
}

export const JOBS_REPOSITORY = Symbol('JobsRepository');
