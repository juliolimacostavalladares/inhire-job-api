import { Injectable, OnModuleInit } from '@nestjs/common';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ProcessJobCollectionUseCase } from '../../application/use-cases/acquisition-use-cases';
import { Job } from 'bullmq';

@Injectable()
export class JobCollectionProcessor implements OnModuleInit {
  constructor(
    private readonly bullmqService: BullMQService,
    private readonly processJobCollectionUseCase: ProcessJobCollectionUseCase,
  ) {}

  onModuleInit(): void {
    this.bullmqService.registerWorker<{ runId: string; tenantId: string }, void>(
      'job-collection',
      async (job: Job<{ runId: string; tenantId: string }>) => {
        await this.processJobCollectionUseCase.execute(job.data.runId, job.data.tenantId);
      },
      5,
    );
  }
}
