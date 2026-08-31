import { Injectable, Inject } from '@nestjs/common';
import { AUDIT_LOGS_REPOSITORY, AuditLogsRepository } from '../ports/audit-logs.repository';
import { HEALTH_CHECK_SERVICE, HealthCheckService } from '../ports/health-check.port';
import { SystemHealthStatus } from '../../domain/health-status.vo';
import { AuditLog } from '../../domain/audit-log.entity';
import { JOB_APPLICATIONS_REPOSITORY, JobApplicationsRepository } from '../../../applications/application/ports/job-applications.repository';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';

@Injectable()
export class CheckHealthUseCase {
  constructor(@Inject(HEALTH_CHECK_SERVICE) private readonly healthService: HealthCheckService) {}

  getLiveness(): SystemHealthStatus {
    return this.healthService.getLiveness();
  }

  async getReadiness(): Promise<SystemHealthStatus> {
    return this.healthService.getReadiness();
  }
}

@Injectable()
export class ReconcilePendingJobsUseCase {
  constructor(
    @Inject(JOB_APPLICATIONS_REPOSITORY) private readonly applicationsRepo: JobApplicationsRepository,
    private readonly bullmqService: BullMQService,
    @Inject(AUDIT_LOGS_REPOSITORY) private readonly auditRepo: AuditLogsRepository,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
    private readonly logger: SanitizedLogger,
  ) {}

  async execute(): Promise<{ reEnqueuedQueued: number; recoveredStuckProcessing: number }> {
    let reEnqueued = 0;
    let recoveredProcessing = 0;

    // 1. Re-enqueue QUEUED applications missing in queue (T-QUEUE-01, SDD-004)
    const queuedApps = await this.applicationsRepo.findQueuedWithoutJob();
    for (const app of queuedApps) {
      await this.bullmqService.addJob(
        'job-application',
        'submit-official-application',
        { applicationId: app.id },
        `application:${app.id}`,
      );
      reEnqueued++;
    }

    // 2. Recover stuck PROCESSING applications past 10 minutes without lock (SDD-004)
    const stuckApps = await this.applicationsRepo.findStuckProcessing(10);
    for (const app of stuckApps) {
      if (app.status === 'PROCESSING') {
        app.markRequiresManualAction('STUCK_TIMEOUT', 'Application timed out during processing without receipt', this.clock.now());
        await this.applicationsRepo.save(app);
        recoveredProcessing++;
      }
    }

    if (reEnqueued > 0 || recoveredProcessing > 0) {
      const audit = AuditLog.create({
        id: this.idGenerator.generate(),
        action: 'SYSTEM_RECONCILIATION',
        targetType: 'JOB_APPLICATIONS',
        details: { reEnqueued, recoveredProcessing },
        now: this.clock.now(),
      });
      await this.auditRepo.save(audit);

      this.logger.log({
        operation: 'system_reconciliation_completed',
        reEnqueued,
        recoveredProcessing,
      }, 'ReconcilePendingJobsUseCase');
    }

    return { reEnqueuedQueued: reEnqueued, recoveredStuckProcessing: recoveredProcessing };
  }
}

@Injectable()
export class GetMetricsUseCase {
  constructor(
    private readonly bullmqService: BullMQService,
    @Inject(JOB_APPLICATIONS_REPOSITORY) private readonly applicationsRepo: JobApplicationsRepository,
  ) {}

  async execute() {
    const queueNames: Array<'tenant-discovery' | 'job-collection' | 'profile-analysis' | 'resume-generation' | 'job-application' | 'auto-apply'> = [
      'tenant-discovery',
      'job-collection',
      'profile-analysis',
      'resume-generation',
      'job-application',
      'auto-apply',
    ];

    const queueMetrics: Record<string, unknown> = {};
    for (const name of queueNames) {
      queueMetrics[name] = await this.bullmqService.getQueueMetrics(name);
    }

    const apps = await this.applicationsRepo.findAll({ limit: 1000 });
    const appStatusCounts: Record<string, number> = {};
    for (const app of apps.items) {
      appStatusCounts[app.status] = (appStatusCounts[app.status] || 0) + 1;
    }

    return {
      timestamp: new Date().toISOString(),
      queues: queueMetrics,
      applications: {
        total: apps.total,
        byStatus: appStatusCounts,
      },
    };
  }
}
