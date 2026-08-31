import { Injectable, OnModuleInit } from '@nestjs/common';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ProcessResumeGenerationUseCase } from '../../application/use-cases/resume-use-cases';
import { AppError } from '@shared/domain/errors/app-error';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { Job } from 'bullmq';

@Injectable()
export class ResumeGenerationProcessor implements OnModuleInit {
  constructor(
    private readonly bullmqService: BullMQService,
    private readonly processResumeGenerationUseCase: ProcessResumeGenerationUseCase,
    private readonly logger: SanitizedLogger,
  ) {}

  onModuleInit(): void {
    this.bullmqService.registerWorker<{ generationId: string; userId: string; jobId: string }, void>(
      'resume-generation',
      async (job: Job<{ generationId: string; userId: string; jobId: string }>) => {
        try {
          await this.processResumeGenerationUseCase.execute(job.data.generationId, job.data.userId, job.data.jobId);
        } catch (err: unknown) {
          if (err instanceof AppError && (err.code === 'RESOURCE_NOT_FOUND' || err.statusCode === 404)) {
            this.logger.warn({
              operation: 'resume_generation_not_found_skipped',
              generationId: job.data.generationId,
              message: `Resume generation ${job.data.generationId} not found in database. Acknowledging job without retry.`,
            }, 'ResumeGenerationProcessor');
            return;
          }
          throw err;
        }
      },
      2,
    );
  }
}
