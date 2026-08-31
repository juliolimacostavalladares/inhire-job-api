import { Injectable, OnModuleInit } from '@nestjs/common';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ProcessJobApplicationUseCase } from '../../application/use-cases/application-use-cases';
import { AppError } from '@shared/domain/errors/app-error';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { Job } from 'bullmq';

@Injectable()
export class JobApplicationProcessor implements OnModuleInit {
  constructor(
    private readonly bullmqService: BullMQService,
    private readonly processJobApplicationUseCase: ProcessJobApplicationUseCase,
    private readonly logger: SanitizedLogger,
  ) {}

  onModuleInit(): void {
    this.bullmqService.registerWorker<{ applicationId: string }, void>(
      'job-application',
      async (job: Job<{ applicationId: string }>) => {
        try {
          await this.processJobApplicationUseCase.execute(job.data.applicationId);
        } catch (err: unknown) {
          if (err instanceof AppError && (err.code === 'RESOURCE_NOT_FOUND' || err.statusCode === 404)) {
            this.logger.warn({
              operation: 'job_application_not_found_skipped',
              applicationId: job.data.applicationId,
              message: `Job application ${job.data.applicationId} not found in database. Acknowledging job without retry.`,
            }, 'JobApplicationProcessor');
            return;
          }
          throw err;
        }
      },
      1, // Concurrency 1 (ADR-009, SDD-004)
    );
  }
}
