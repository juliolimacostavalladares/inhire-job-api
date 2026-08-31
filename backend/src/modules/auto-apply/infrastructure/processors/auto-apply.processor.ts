import { Injectable, OnModuleInit } from '@nestjs/common';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { EvaluateAutoApplyUseCase } from '../../application/use-cases/auto-apply-use-cases';
import { Job } from 'bullmq';

@Injectable()
export class AutoApplyProcessor implements OnModuleInit {
  constructor(
    private readonly bullmqService: BullMQService,
    private readonly evaluateAutoApplyUseCase: EvaluateAutoApplyUseCase,
  ) {}

  onModuleInit(): void {
    this.bullmqService.registerWorker<{ userId: string; evaluationDate?: string }, void>(
      'auto-apply',
      async (job: Job<{ userId: string; evaluationDate?: string }>) => {
        await this.evaluateAutoApplyUseCase.execute(job.data.userId, job.data.evaluationDate);
      },
      2,
    );
  }
}
