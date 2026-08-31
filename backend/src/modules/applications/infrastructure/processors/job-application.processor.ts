import { Injectable, OnModuleInit } from '@nestjs/common';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ProcessJobApplicationUseCase } from '../../application/use-cases/application-use-cases';
import { Job } from 'bullmq';

@Injectable()
export class JobApplicationProcessor implements OnModuleInit {
  constructor(
    private readonly bullmqService: BullMQService,
    private readonly processJobApplicationUseCase: ProcessJobApplicationUseCase,
  ) {}

  onModuleInit(): void {
    this.bullmqService.registerWorker<{ applicationId: string }, void>(
      'job-application',
      async (job: Job<{ applicationId: string }>) => {
        await this.processJobApplicationUseCase.execute(job.data.applicationId);
      },
      1, // Concurrency 1 (ADR-009, SDD-004)
    );
  }
}
