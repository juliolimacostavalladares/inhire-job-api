import { Injectable } from '@nestjs/common';
import { CatalogService } from '../application/ports/catalog-service.interface';
import { Job, JobSnapshot, FormFieldSchema } from '../domain/job.entity';
import { Tenant } from '../domain/tenant.entity';
import { GetJobUseCase, GetApplicationSnapshotUseCase, GetApplicationFormUseCase, UpsertTenantUseCase, UpsertJobUseCase, CloseMissingJobsUseCase } from '../application/use-cases/catalog-use-cases';

@Injectable()
export class CatalogFacade implements CatalogService {
  constructor(
    private readonly getJobUseCase: GetJobUseCase,
    private readonly getApplicationSnapshotUseCase: GetApplicationSnapshotUseCase,
    private readonly getApplicationFormUseCase: GetApplicationFormUseCase,
    private readonly upsertTenantUseCase: UpsertTenantUseCase,
    private readonly upsertJobUseCase: UpsertJobUseCase,
    private readonly closeMissingJobsUseCase: CloseMissingJobsUseCase,
  ) {}

  async getJob(id: string): Promise<Job> {
    return this.getJobUseCase.execute(id);
  }

  async getApplicationSnapshot(id: string): Promise<JobSnapshot> {
    return this.getApplicationSnapshotUseCase.execute(id);
  }

  async getApplicationForm(id: string): Promise<FormFieldSchema[]> {
    return this.getApplicationFormUseCase.execute(id);
  }

  async upsertTenant(data: { slug: string; name: string; officialUrl: string }): Promise<Tenant> {
    return this.upsertTenantUseCase.execute(data);
  }

  async upsertJob(data: {
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
    return this.upsertJobUseCase.execute(data);
  }

  async closeMissingJobs(tenantId: string, observedExternalIds: string[]): Promise<number> {
    return this.closeMissingJobsUseCase.execute(tenantId, observedExternalIds);
  }
}
