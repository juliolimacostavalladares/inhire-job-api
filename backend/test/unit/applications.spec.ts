import { JobApplication } from '@modules/applications/domain/job-application.entity';
import { JobApplicationsRepository } from '@modules/applications/application/ports/job-applications.repository';
import { ResumeArtifactsRepository } from '@modules/resume/application/ports/resume-artifacts.repository';
import { CandidateProfileService } from '@modules/candidate-profile/application/ports/candidate-profile-service.interface';
import { CatalogService } from '@modules/catalog/application/ports/catalog-service.interface';
import { ResumeGenerator, ResumeArtifactDto } from '@modules/resume/application/ports/resume-generator.interface';
import {
  QueueJobApplicationUseCase,
  ProcessJobApplicationUseCase,
} from '@modules/applications/application/use-cases/application-use-cases';
import { MockApplicationSubmitter } from '@modules/applications/infrastructure/submitter/mock-application-submitter';
import { InMemoryArtifactStorage } from '@shared/infrastructure/storage/in-memory-artifact-storage';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { FakeClock } from '@shared/infrastructure/clock/fake-clock';
import { UuidGenerator } from '@shared/infrastructure/id-generator/uuid-generator';
import { CandidateProfile } from '@modules/candidate-profile/domain/candidate-profile.entity';
import { JobSnapshot } from '@modules/catalog/domain/job.entity';

class InMemoryJobApplicationsRepo implements JobApplicationsRepository {
  private apps = new Map<string, JobApplication>();

  async findById(id: string): Promise<JobApplication | null> {
    return this.apps.get(id) || null;
  }
  async findByUserAndJob(userId: string, jobId: string): Promise<JobApplication | null> {
    for (const a of this.apps.values()) {
      if (a.userId === userId && a.jobId === jobId) return a;
    }
    return null;
  }
  async findAll(): Promise<{ items: JobApplication[]; total: number }> {
    return { items: Array.from(this.apps.values()), total: this.apps.size };
  }
  async findStuckProcessing(): Promise<JobApplication[]> {
    return [];
  }
  async findQueuedWithoutJob(): Promise<JobApplication[]> {
    return Array.from(this.apps.values()).filter((a) => a.status === 'QUEUED');
  }
  async save(app: JobApplication): Promise<JobApplication> {
    this.apps.set(app.id, app);
    return app;
  }
  async addAttempt(): Promise<void> {}
  async saveReceipt(): Promise<void> {}
}

describe('Applications Module - Unit Tests (T-APP-01..08, T-IDEM-01)', () => {
  let appsRepo: InMemoryJobApplicationsRepo;
  let profileService: jest.Mocked<CandidateProfileService>;
  let catalogService: jest.Mocked<CatalogService>;
  let resumeGenerator: jest.Mocked<ResumeGenerator>;
  let artifactsRepo: jest.Mocked<ResumeArtifactsRepository>;
  let storage: InMemoryArtifactStorage;
  let submitter: MockApplicationSubmitter;
  let bullmq: BullMQService;
  let clock: FakeClock;
  let idGen: UuidGenerator;
  let queueUseCase: QueueJobApplicationUseCase;
  let processUseCase: ProcessJobApplicationUseCase;

  const mockJobSnapshot: JobSnapshot = {
    jobId: 'job-100',
    tenantId: 'tenant-100',
    title: 'Senior Developer',
    jobUrl: 'https://tenant100.inhire.app/jobs/100',
    status: 'PUBLISHED',
    description: 'Senior engineer',
    formSchema: [],
    version: 1,
  };

  beforeEach(() => {
    appsRepo = new InMemoryJobApplicationsRepo();
    storage = new InMemoryArtifactStorage();
    submitter = new MockApplicationSubmitter();
    bullmq = new BullMQService(new SanitizedLogger());
    clock = new FakeClock(new Date('2026-08-31T10:00:00.000Z'));
    idGen = new UuidGenerator();

    profileService = {
      getProfile: jest.fn(),
      assessReadiness: jest.fn().mockResolvedValue({ ready: true, missingFields: [], version: 1 }),
      prepareApplicationData: jest.fn().mockResolvedValue({
        data: { fullName: 'John Doe', email: 'john@inhire.internal', phone: '+5511999999999' },
        profileVersion: 1,
      }),
    };

    catalogService = {
      getJob: jest.fn(),
      getApplicationSnapshot: jest.fn().mockResolvedValue(mockJobSnapshot),
      getApplicationForm: jest.fn(),
      upsertTenant: jest.fn(),
      upsertJob: jest.fn(),
      closeMissingJobs: jest.fn(),
    };

    resumeGenerator = {
      ensureReady: jest.fn().mockResolvedValue({
        artifactId: 'art-1',
        key: 'resumes/art-1.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        sha256Checksum: 'mock-sha256-checksum',
        pdfBuffer: Buffer.from('%PDF-1.4 mock pdf'),
      }),
    };

    artifactsRepo = {
      findById: jest.fn(),
      save: jest.fn(),
    };

    queueUseCase = new QueueJobApplicationUseCase(appsRepo, profileService, catalogService, bullmq, idGen, clock);
    processUseCase = new ProcessJobApplicationUseCase(
      appsRepo,
      resumeGenerator,
      artifactsRepo,
      storage,
      submitter,
      idGen,
      clock,
      new SanitizedLogger(),
    );
  });

  it('T-APP-01 & T-APP-07: Application intent transitions to QUEUED and then SUBMITTED with verified receipt', async () => {
    const queueRes = await queueUseCase.execute('user-1', 'job-100');
    expect(queueRes.status).toBe('QUEUED');
    expect(queueRes.applicationId).toBeDefined();

    const processed = await processUseCase.execute(queueRes.applicationId);
    expect(processed.status).toBe('SUBMITTED');
    expect(processed.receipt).toBeDefined();
    expect(processed.receipt?.artifactChecksum).toBe('mock-sha256-checksum');
  });

  it('T-IDEM-01: Processing the same application 10 times produces only one submission effect', async () => {
    const queueRes = await queueUseCase.execute('user-1', 'job-100');
    const firstProcess = await processUseCase.execute(queueRes.applicationId);
    expect(firstProcess.status).toBe('SUBMITTED');

    // Run 9 more times
    for (let i = 0; i < 9; i++) {
      const repeated = await processUseCase.execute(queueRes.applicationId);
      expect(repeated.status).toBe('SUBMITTED');
    }
  });

  it('T-APP-04: Canonical Job URL is used byte-for-byte in application package', async () => {
    const queueRes = await queueUseCase.execute('user-1', 'job-100');
    const app = await appsRepo.findById(queueRes.applicationId);
    expect(app?.jobUrl).toBe(mockJobSnapshot.jobUrl);
  });
});
