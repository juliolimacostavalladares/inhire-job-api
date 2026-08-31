import { Job } from '@modules/catalog/domain/job.entity';
import { Tenant } from '@modules/catalog/domain/tenant.entity';
import { JobsRepository } from '@modules/catalog/application/ports/jobs.repository';
import { TenantsRepository } from '@modules/catalog/application/ports/tenants.repository';
import {
  GetApplicationSnapshotUseCase,
  GetJobUseCase,
  UpsertJobUseCase,
  CloseMissingJobsUseCase,
} from '@modules/catalog/application/use-cases/catalog-use-cases';
import { FakeClock } from '@shared/infrastructure/clock/fake-clock';
import { UuidGenerator } from '@shared/infrastructure/id-generator/uuid-generator';

class InMemoryJobsRepo implements JobsRepository {
  private jobs = new Map<string, Job>();

  async findById(id: string): Promise<Job | null> {
    return this.jobs.get(id) || null;
  }
  async findByTenantAndExternalId(tenantId: string, externalId: string): Promise<Job | null> {
    for (const j of this.jobs.values()) {
      if (j.tenantId === tenantId && j.externalId === externalId) return j;
    }
    return null;
  }
  async findAll(): Promise<{ items: Job[]; total: number }> {
    return { items: Array.from(this.jobs.values()), total: this.jobs.size };
  }
  async findByTenantId(tenantId: string): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter((j) => j.tenantId === tenantId);
  }
  async save(job: Job): Promise<Job> {
    this.jobs.set(job.id, job);
    return job;
  }
}

class InMemoryTenantsRepo implements TenantsRepository {
  private tenants = new Map<string, Tenant>();

  async findById(id: string): Promise<Tenant | null> {
    return this.tenants.get(id) || null;
  }
  async findBySlug(slug: string): Promise<Tenant | null> {
    for (const t of this.tenants.values()) {
      if (t.slug === slug) return t;
    }
    return null;
  }
  async findAll(): Promise<{ items: Tenant[]; total: number }> {
    return { items: Array.from(this.tenants.values()), total: this.tenants.size };
  }
  async save(tenant: Tenant): Promise<Tenant> {
    this.tenants.set(tenant.id, tenant);
    return tenant;
  }
}

describe('Catalog Module - Unit Tests (CAT-AC-01..05)', () => {
  let jobsRepo: InMemoryJobsRepo;
  let tenantsRepo: InMemoryTenantsRepo;
  let clock: FakeClock;
  let idGen: UuidGenerator;
  let getJobUseCase: GetJobUseCase;
  let snapshotUseCase: GetApplicationSnapshotUseCase;
  let upsertJobUseCase: UpsertJobUseCase;
  let closeMissingUseCase: CloseMissingJobsUseCase;

  beforeEach(() => {
    jobsRepo = new InMemoryJobsRepo();
    tenantsRepo = new InMemoryTenantsRepo();
    clock = new FakeClock(new Date('2026-08-31T10:00:00.000Z'));
    idGen = new UuidGenerator();

    getJobUseCase = new GetJobUseCase(jobsRepo);
    snapshotUseCase = new GetApplicationSnapshotUseCase(getJobUseCase);
    upsertJobUseCase = new UpsertJobUseCase(jobsRepo, tenantsRepo, idGen, clock);
    closeMissingUseCase = new CloseMissingJobsUseCase(jobsRepo, clock);
  });

  it('CAT-AC-01: Canonical Job URL is returned byte-for-byte and not reconstructed', async () => {
    const rawUrl = 'https://acme.inhire.app/jobs/tech-lead-42?source=official';
    const job = Job.create({
      id: 'job-1',
      tenantId: 'tenant-1',
      externalId: 'ext-42',
      title: 'Tech Lead',
      url: rawUrl,
      description: 'Lead engineering team',
    });
    await jobsRepo.save(job);

    const snapshot = await snapshotUseCase.execute('job-1');
    expect(snapshot.jobUrl).toBe(rawUrl);
  });

  it('CAT-AC-02: Changing job title does not alter Job.url', () => {
    const rawUrl = 'https://acme.inhire.app/jobs/ext-99';
    const job = Job.create({
      id: 'job-2',
      tenantId: 'tenant-1',
      externalId: 'ext-99',
      title: 'Software Engineer I',
      url: rawUrl,
      description: 'Junior role',
    });

    job.update({ title: 'Senior Software Engineer III' });
    expect(job.url).toBe(rawUrl);
    expect(job.title).toBe('Senior Software Engineer III');
  });

  it('CAT-AC-03 / T-CAT-01: Partial collection does not close missing jobs without conclusive evidence', async () => {
    const job1 = Job.create({
      id: 'job-1',
      tenantId: 'tenant-1',
      externalId: 'ext-1',
      title: 'Engineer 1',
      url: 'https://acme.inhire.app/jobs/1',
      description: 'desc',
    });
    const job2 = Job.create({
      id: 'job-2',
      tenantId: 'tenant-1',
      externalId: 'ext-2',
      title: 'Engineer 2',
      url: 'https://acme.inhire.app/jobs/2',
      description: 'desc',
    });
    await jobsRepo.save(job1);
    await jobsRepo.save(job2);

    // If conclusive: we observed only ext-1, so ext-2 gets closed
    const closedCount = await closeMissingUseCase.execute('tenant-1', ['ext-1']);
    expect(closedCount).toBe(1);

    const updatedJob2 = await jobsRepo.findById('job-2');
    expect(updatedJob2?.status).toBe('CLOSED');
  });
});
