import { Module } from '@nestjs/common';
import { AcquisitionController } from './presentation/acquisition.controller';
import {
  CreateDiscoveryRunUseCase,
  CreateCollectionRunUseCase,
  ProcessTenantDiscoveryUseCase,
  ProcessJobCollectionUseCase,
  ListRunsUseCase,
  GetRunUseCase,
} from './application/use-cases/acquisition-use-cases';
import { CRAWL_RUNS_REPOSITORY } from './application/ports/crawl-runs.repository';
import { JOB_COLLECTOR_CLIENT } from './application/ports/job-collector.client';
import { JOB_PROFILE_AI_MATCHER } from './application/ports/job-profile-ai-matcher.port';
import { PrismaCrawlRunsRepository } from './infrastructure/prisma-crawl-runs.repository';
import { MockOrHttpJobCollectorClient } from './infrastructure/clients/mock-or-http-job-collector.client';
import { LlmJobProfileMatcher } from './infrastructure/ai/llm-job-profile-matcher';
import { OpenRouterAiClient } from '@shared/infrastructure/ai/openrouter-ai.client';
import { TenantDiscoveryProcessor } from './infrastructure/processors/tenant-discovery.processor';
import { JobCollectionProcessor } from './infrastructure/processors/job-collection.processor';
import { CatalogModule } from '../catalog/catalog.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { CLOCK_PORT } from '@shared/domain/ports/clock.port';
import { SystemClock } from '@shared/infrastructure/clock/system-clock';
import { ID_GENERATOR_PORT } from '@shared/domain/ports/id-generator.port';
import { UuidGenerator } from '@shared/infrastructure/id-generator/uuid-generator';
import { TENANTS_REPOSITORY } from '../catalog/application/ports/tenants.repository';
import { PrismaTenantsRepository } from '../catalog/infrastructure/prisma-tenants.repository';

@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [AcquisitionController],
  providers: [
    PrismaService,
    BullMQService,
    SanitizedLogger,
    CreateDiscoveryRunUseCase,
    CreateCollectionRunUseCase,
    ProcessTenantDiscoveryUseCase,
    ProcessJobCollectionUseCase,
    ListRunsUseCase,
    GetRunUseCase,
    TenantDiscoveryProcessor,
    JobCollectionProcessor,
    OpenRouterAiClient,
    { provide: CRAWL_RUNS_REPOSITORY, useClass: PrismaCrawlRunsRepository },
    { provide: JOB_COLLECTOR_CLIENT, useClass: MockOrHttpJobCollectorClient },
    { provide: JOB_PROFILE_AI_MATCHER, useClass: LlmJobProfileMatcher },
    { provide: TENANTS_REPOSITORY, useClass: PrismaTenantsRepository },
    { provide: CLOCK_PORT, useClass: SystemClock },
    { provide: ID_GENERATOR_PORT, useClass: UuidGenerator },
  ],
  exports: [
    CreateDiscoveryRunUseCase,
    CreateCollectionRunUseCase,
  ],
})
export class AcquisitionModule {}
