import { Module } from '@nestjs/common';
import { HealthController } from './presentation/health.controller';
import { OperationsController } from './presentation/operations.controller';
import {
  CheckHealthUseCase,
  ReconcilePendingJobsUseCase,
  GetMetricsUseCase,
} from './application/use-cases/operations-use-cases';
import { AUDIT_LOGS_REPOSITORY } from './application/ports/audit-logs.repository';
import { HEALTH_CHECK_SERVICE } from './application/ports/health-check.port';
import { PrismaAuditLogsRepository } from './infrastructure/prisma-audit-logs.repository';
import { SystemHealthService } from './infrastructure/health/system-health.service';
import { AuthModule } from '../auth/auth.module';
import { ApplicationsModule } from '../applications/applications.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { CLOCK_PORT } from '@shared/domain/ports/clock.port';
import { SystemClock } from '@shared/infrastructure/clock/system-clock';
import { ID_GENERATOR_PORT } from '@shared/domain/ports/id-generator.port';
import { UuidGenerator } from '@shared/infrastructure/id-generator/uuid-generator';
import { ARTIFACT_STORAGE_PORT } from '@shared/infrastructure/storage/artifact-storage.port';
import { S3MinioArtifactStorage } from '@shared/infrastructure/storage/s3-minio-artifact-storage';

@Module({
  imports: [AuthModule, ApplicationsModule],
  controllers: [HealthController, OperationsController],
  providers: [
    PrismaService,
    BullMQService,
    SanitizedLogger,
    CheckHealthUseCase,
    ReconcilePendingJobsUseCase,
    GetMetricsUseCase,
    { provide: AUDIT_LOGS_REPOSITORY, useClass: PrismaAuditLogsRepository },
    { provide: HEALTH_CHECK_SERVICE, useClass: SystemHealthService },
    { provide: ARTIFACT_STORAGE_PORT, useClass: S3MinioArtifactStorage },
    { provide: CLOCK_PORT, useClass: SystemClock },
    { provide: ID_GENERATOR_PORT, useClass: UuidGenerator },
  ],
  exports: [
    CheckHealthUseCase,
    ReconcilePendingJobsUseCase,
    GetMetricsUseCase,
  ],
})
export class OperationsModule {}
