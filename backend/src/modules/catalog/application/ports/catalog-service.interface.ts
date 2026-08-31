import { Job, JobSnapshot, FormFieldSchema } from '../../domain/job.entity';
import { Tenant } from '../../domain/tenant.entity';

export interface CatalogService {
  getJob(id: string): Promise<Job>;
  getApplicationSnapshot(id: string): Promise<JobSnapshot>;
  getApplicationForm(id: string): Promise<FormFieldSchema[]>;
  upsertTenant(data: { slug: string; name: string; officialUrl: string }): Promise<Tenant>;
  upsertJob(data: {
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
  }): Promise<Job>;
  closeMissingJobs(tenantId: string, observedExternalIds: string[]): Promise<number>;
}

export const CATALOG_SERVICE = Symbol('CatalogService');
