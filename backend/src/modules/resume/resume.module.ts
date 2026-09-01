import { Module } from '@nestjs/common';
import { ResumeController } from './presentation/resume.controller';
import {
  RequestResumeGenerationUseCase,
  ProcessResumeGenerationUseCase,
  EnsureReadyResumeUseCase,
  GetResumeByJobUseCase,
  GetResumeGenerationUseCase,
  DownloadResumeArtifactUseCase,
} from './application/use-cases/resume-use-cases';
import { TAILORED_RESUMES_REPOSITORY } from './application/ports/tailored-resumes.repository';
import { RESUME_ARTIFACTS_REPOSITORY } from './application/ports/resume-artifacts.repository';
import { AI_PROVIDER } from './application/ports/ai-provider.port';
import { PDF_RENDERER } from './application/ports/pdf-renderer.port';
import { RESUME_GENERATOR } from './application/ports/resume-generator.interface';
import { PrismaTailoredResumesRepository } from './infrastructure/prisma-tailored-resumes.repository';
import { PrismaResumeArtifactsRepository } from './infrastructure/prisma-resume-artifacts.repository';
import { NineRouterAiResumeProvider } from './infrastructure/ai/ninerouter-ai-resume.provider';
import { PlaywrightPdfRenderer } from './infrastructure/pdf/playwright-pdf-renderer';
import { ResumeGenerationProcessor } from './infrastructure/processors/resume-generation.processor';
import { CandidateProfileModule } from '../candidate-profile/candidate-profile.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { NineRouterAiClient } from '@shared/infrastructure/ai/ninerouter-ai.client';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { CLOCK_PORT } from '@shared/domain/ports/clock.port';
import { SystemClock } from '@shared/infrastructure/clock/system-clock';
import { ID_GENERATOR_PORT } from '@shared/domain/ports/id-generator.port';
import { UuidGenerator } from '@shared/infrastructure/id-generator/uuid-generator';
import { ARTIFACT_STORAGE_PORT } from '@shared/infrastructure/storage/artifact-storage.port';
import { S3MinioArtifactStorage } from '@shared/infrastructure/storage/s3-minio-artifact-storage';

@Module({
  imports: [AuthModule, CandidateProfileModule, CatalogModule],
  controllers: [ResumeController],
  providers: [
    PrismaService,
    BullMQService,
    NineRouterAiClient,
    SanitizedLogger,
    RequestResumeGenerationUseCase,
    ProcessResumeGenerationUseCase,
    EnsureReadyResumeUseCase,
    GetResumeByJobUseCase,
    GetResumeGenerationUseCase,
    DownloadResumeArtifactUseCase,
    ResumeGenerationProcessor,
    { provide: TAILORED_RESUMES_REPOSITORY, useClass: PrismaTailoredResumesRepository },
    { provide: RESUME_ARTIFACTS_REPOSITORY, useClass: PrismaResumeArtifactsRepository },
    { provide: AI_PROVIDER, useClass: NineRouterAiResumeProvider },
    { provide: PDF_RENDERER, useClass: PlaywrightPdfRenderer },
    { provide: RESUME_GENERATOR, useClass: EnsureReadyResumeUseCase },
    { provide: ARTIFACT_STORAGE_PORT, useClass: S3MinioArtifactStorage },
    { provide: CLOCK_PORT, useClass: SystemClock },
    { provide: ID_GENERATOR_PORT, useClass: UuidGenerator },
  ],
  exports: [
    RESUME_GENERATOR,
    RequestResumeGenerationUseCase,
    ProcessResumeGenerationUseCase,
    RESUME_ARTIFACTS_REPOSITORY,
    ARTIFACT_STORAGE_PORT,
  ],
})
export class ResumeModule {}
