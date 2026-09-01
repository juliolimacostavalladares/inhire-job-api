import { Module } from '@nestjs/common';
import { ApplicationsController } from './presentation/applications.controller';
import { AdminApplicationsController } from './presentation/admin-applications.controller';
import {
  QueueJobApplicationUseCase,
  ProcessJobApplicationUseCase,
  GetApplicationUseCase,
  ListApplicationsUseCase,
  GetApplicationAttemptsUseCase,
  RetryApplicationUseCase,
} from './application/use-cases/application-use-cases';
import { JOB_APPLICATIONS_REPOSITORY } from './application/ports/job-applications.repository';
import { OFFICIAL_APPLICATION_SUBMITTER } from './application/ports/official-application-submitter.port';
import { PrismaJobApplicationsRepository } from './infrastructure/prisma-job-applications.repository';
import { MockApplicationSubmitter } from './infrastructure/submitter/mock-application-submitter';
import { JobApplicationProcessor } from './infrastructure/processors/job-application.processor';
import { AuthModule } from '../auth/auth.module';
import { CandidateProfileModule } from '../candidate-profile/candidate-profile.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ResumeModule } from '../resume/resume.module';
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
  imports: [AuthModule, CandidateProfileModule, CatalogModule, ResumeModule],
  controllers: [ApplicationsController, AdminApplicationsController],
  providers: [
    PrismaService,
    BullMQService,
    SanitizedLogger,
    QueueJobApplicationUseCase,
    ProcessJobApplicationUseCase,
    GetApplicationUseCase,
    ListApplicationsUseCase,
    GetApplicationAttemptsUseCase,
    RetryApplicationUseCase,
    JobApplicationProcessor,
    { provide: JOB_APPLICATIONS_REPOSITORY, useClass: PrismaJobApplicationsRepository },
    { provide: OFFICIAL_APPLICATION_SUBMITTER, useClass: MockApplicationSubmitter },
    { provide: ARTIFACT_STORAGE_PORT, useClass: S3MinioArtifactStorage },
    { provide: CLOCK_PORT, useClass: SystemClock },
    { provide: ID_GENERATOR_PORT, useClass: UuidGenerator },
  ],
  exports: [
    QueueJobApplicationUseCase,
    ProcessJobApplicationUseCase,
    JOB_APPLICATIONS_REPOSITORY,
  ],
})
export class ApplicationsModule {}
