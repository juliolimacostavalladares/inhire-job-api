import { Injectable, OnModuleInit } from '@nestjs/common';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ProcessProfileAnalysisUseCase } from '../../application/use-cases/process-profile-analysis.use-case';
import { Job } from 'bullmq';

@Injectable()
export class ProfileAnalysisProcessor implements OnModuleInit {
  constructor(
    private readonly bullmqService: BullMQService,
    private readonly processProfileAnalysisUseCase: ProcessProfileAnalysisUseCase,
  ) {}

  onModuleInit(): void {
    this.bullmqService.registerWorker<{ importId: string; userId: string }, void>(
      'profile-analysis',
      async (job: Job<{ importId: string; userId: string }>) => {
        await this.processProfileAnalysisUseCase.execute(job.data.importId, job.data.userId);
      },
      2,
    );
  }
}
