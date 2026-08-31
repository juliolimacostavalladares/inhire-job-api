import { Injectable, OnModuleInit } from '@nestjs/common';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ProcessResumeGenerationUseCase } from '../../application/use-cases/resume-use-cases';
import { Job } from 'bullmq';

@Injectable()
export class ResumeGenerationProcessor implements OnModuleInit {
  constructor(
    private readonly bullmqService: BullMQService,
    private readonly processResumeGenerationUseCase: ProcessResumeGenerationUseCase,
  ) {}

  onModuleInit(): void {
    this.bullmqService.registerWorker<{ generationId: string; userId: string; jobId: string }, void>(
      'resume-generation',
      async (job: Job<{ generationId: string; userId: string; jobId: string }>) => {
        await this.processResumeGenerationUseCase.execute(job.data.generationId, job.data.userId, job.data.jobId);
      },
      2,
    );
  }
}
