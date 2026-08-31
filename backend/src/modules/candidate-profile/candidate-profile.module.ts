import { Module } from '@nestjs/common';
import { CandidateProfileController } from './presentation/candidate-profile.controller';
import { GetProfileUseCase } from './application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';
import { ImportProfileUseCase } from './application/use-cases/import-profile.use-case';
import { GetImportAttemptUseCase } from './application/use-cases/get-import-attempt.use-case';
import { AssessReadinessUseCase } from './application/use-cases/assess-readiness.use-case';
import { ProcessProfileAnalysisUseCase } from './application/use-cases/process-profile-analysis.use-case';
import { CANDIDATE_PROFILE_REPOSITORY } from './application/ports/candidate-profile.repository';
import { PROFILE_IMPORT_ATTEMPTS_REPOSITORY } from './application/ports/profile-import-attempts.repository';
import { PROFILE_AI_EXTRACTOR } from './application/ports/profile-ai-extractor.port';
import { CANDIDATE_PROFILE_SERVICE } from './application/ports/candidate-profile-service.interface';
import { PrismaCandidateProfileRepository } from './infrastructure/prisma-candidate-profile.repository';
import { PrismaProfileImportAttemptsRepository } from './infrastructure/prisma-profile-import-attempts.repository';
import { LlmProfileAiExtractor } from './infrastructure/ai/llm-profile-ai-extractor';
import { CandidateProfileFacade } from './infrastructure/candidate-profile-facade';
import { ProfileAnalysisProcessor } from './infrastructure/processors/profile-analysis.processor';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ARTIFACT_STORAGE_PORT } from '@shared/infrastructure/storage/artifact-storage.port';
import { InMemoryArtifactStorage } from '@shared/infrastructure/storage/in-memory-artifact-storage';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { CLOCK_PORT } from '@shared/domain/ports/clock.port';
import { SystemClock } from '@shared/infrastructure/clock/system-clock';
import { ID_GENERATOR_PORT } from '@shared/domain/ports/id-generator.port';
import { UuidGenerator } from '@shared/infrastructure/id-generator/uuid-generator';

@Module({
  imports: [AuthModule],
  controllers: [CandidateProfileController],
  providers: [
    PrismaService,
    BullMQService,
    SanitizedLogger,
    GetProfileUseCase,
    UpdateProfileUseCase,
    ImportProfileUseCase,
    GetImportAttemptUseCase,
    AssessReadinessUseCase,
    ProcessProfileAnalysisUseCase,
    ProfileAnalysisProcessor,
    { provide: CANDIDATE_PROFILE_REPOSITORY, useClass: PrismaCandidateProfileRepository },
    { provide: PROFILE_IMPORT_ATTEMPTS_REPOSITORY, useClass: PrismaProfileImportAttemptsRepository },
    { provide: PROFILE_AI_EXTRACTOR, useClass: LlmProfileAiExtractor },
    { provide: CANDIDATE_PROFILE_SERVICE, useClass: CandidateProfileFacade },
    { provide: ARTIFACT_STORAGE_PORT, useClass: InMemoryArtifactStorage },
    { provide: CLOCK_PORT, useClass: SystemClock },
    { provide: ID_GENERATOR_PORT, useClass: UuidGenerator },
  ],
  exports: [
    CANDIDATE_PROFILE_SERVICE,
    CANDIDATE_PROFILE_REPOSITORY,
    GetProfileUseCase,
    AssessReadinessUseCase,
    ARTIFACT_STORAGE_PORT,
  ],
})
export class CandidateProfileModule {}
