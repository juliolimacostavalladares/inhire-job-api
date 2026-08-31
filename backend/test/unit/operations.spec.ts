import { ReconcilePendingJobsUseCase } from '@modules/operations/application/use-cases/operations-use-cases';
import { JobApplication } from '@modules/applications/domain/job-application.entity';
import { AuditLog } from '@modules/operations/domain/audit-log.entity';
import { JobApplicationsRepository } from '@modules/applications/application/ports/job-applications.repository';
import { AuditLogsRepository } from '@modules/operations/application/ports/audit-logs.repository';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { FakeClock } from '@shared/infrastructure/clock/fake-clock';
import { UuidGenerator } from '@shared/infrastructure/id-generator/uuid-generator';

class InMemoryApplicationsRepo implements JobApplicationsRepository {
  private apps = new Map<string, JobApplication>();

  async findById(id: string) { return this.apps.get(id) || null; }
  async findByUserAndJob() { return null; }
  async findAll() { return { items: Array.from(this.apps.values()), total: this.apps.size }; }
  async findStuckProcessing() { return []; }
  async findQueuedWithoutJob() {
    return Array.from(this.apps.values()).filter((a) => a.status === 'QUEUED');
  }
  async save(app: JobApplication) { this.apps.set(app.id, app); return app; }
  async addAttempt() {}
  async saveReceipt() {}
}

class InMemoryAuditRepo implements AuditLogsRepository {
  private logs: AuditLog[] = [];
  async save(log: AuditLog) { this.logs.push(log); return log; }
  async findAll() { return { items: this.logs, total: this.logs.length }; }
}

describe('Operations & Reconciler - Unit Tests (T-QUEUE-01 / T-SEC-02)', () => {
  it('T-QUEUE-01: Reconciler detects QUEUED applications missing in queue and re-enqueues them safely', async () => {
    const appsRepo = new InMemoryApplicationsRepo();
    const auditRepo = new InMemoryAuditRepo();
    const bullmq = new BullMQService(new SanitizedLogger());
    const clock = new FakeClock();
    const idGen = new UuidGenerator();

    const queuedApp = JobApplication.create({
      id: 'app-un-enqueued',
      userId: 'user-1',
      jobId: 'job-1',
      jobUrl: 'https://test.inhire.app/jobs/1',
      resumeMode: 'AI_TAILORED',
    });
    await appsRepo.save(queuedApp);

    const reconciler = new ReconcilePendingJobsUseCase(
      appsRepo,
      bullmq,
      auditRepo,
      idGen,
      clock,
      new SanitizedLogger(),
    );

    const result = await reconciler.execute();
    expect(result.reEnqueuedQueued).toBe(1);
  });

  it('T-SEC-02: SanitizedLogger strips passwords, tokens, PII and base64 from output', () => {
    const logger = new SanitizedLogger();
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    logger.log({
      operation: 'user_login',
      password: 'MySecretPassword123',
      token: 'jwt.token.here',
      email: 'user@inhire.internal',
      safeMetric: 42,
    });

    expect(spy).toHaveBeenCalled();
    const logCall = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logCall);

    expect(parsed.password).toBe('[REDACTED]');
    expect(parsed.token).toBe('[REDACTED]');
    expect(parsed.email).toBe('[REDACTED]');
    expect(parsed.safeMetric).toBe(42);

    spy.mockRestore();
  });
});
