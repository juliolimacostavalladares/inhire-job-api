import { Injectable, OnModuleInit } from '@nestjs/common';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ProcessTenantDiscoveryUseCase } from '../../application/use-cases/acquisition-use-cases';
import { Job } from 'bullmq';

@Injectable()
export class TenantDiscoveryProcessor implements OnModuleInit {
  constructor(
    private readonly bullmqService: BullMQService,
    private readonly processTenantDiscoveryUseCase: ProcessTenantDiscoveryUseCase,
  ) {}

  onModuleInit(): void {
    this.bullmqService.registerWorker<{ runId: string }, void>(
      'tenant-discovery',
      async (job: Job<{ runId: string }>) => {
        await this.processTenantDiscoveryUseCase.execute(job.data.runId);
      },
      1,
    );
  }
}
