import { Module } from '@nestjs/common';
import { AutoApplyController } from './presentation/auto-apply.controller';
import {
  GetPolicyUseCase,
  UpdatePolicyUseCase,
  EvaluateAutoApplyUseCase,
  ListDecisionsUseCase,
} from './application/use-cases/auto-apply-use-cases';
import { AUTO_APPLY_POLICIES_REPOSITORY } from './application/ports/auto-apply-policies.repository';
import { AUTO_APPLY_DECISIONS_REPOSITORY } from './application/ports/auto-apply-decisions.repository';
import { PrismaAutoApplyPoliciesRepository } from './infrastructure/prisma-auto-apply-policies.repository';
import { PrismaAutoApplyDecisionsRepository } from './infrastructure/prisma-auto-apply-decisions.repository';
import { AutoApplyProcessor } from './infrastructure/processors/auto-apply.processor';
import { AuthModule } from '../auth/auth.module';
import { CandidateProfileModule } from '../candidate-profile/candidate-profile.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ApplicationsModule } from '../applications/applications.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { CLOCK_PORT } from '@shared/domain/ports/clock.port';
import { SystemClock } from '@shared/infrastructure/clock/system-clock';
import { ID_GENERATOR_PORT } from '@shared/domain/ports/id-generator.port';
import { UuidGenerator } from '@shared/infrastructure/id-generator/uuid-generator';
import { JOBS_REPOSITORY } from '../catalog/application/ports/jobs.repository';
import { PrismaJobsRepository } from '../catalog/infrastructure/prisma-jobs.repository';
import { JOB_APPLICATIONS_REPOSITORY } from '../applications/application/ports/job-applications.repository';
import { PrismaJobApplicationsRepository } from '../applications/infrastructure/prisma-job-applications.repository';

@Module({
  imports: [AuthModule, CandidateProfileModule, CatalogModule, ApplicationsModule],
  controllers: [AutoApplyController],
  providers: [
    PrismaService,
    BullMQService,
    SanitizedLogger,
    GetPolicyUseCase,
    UpdatePolicyUseCase,
    EvaluateAutoApplyUseCase,
    ListDecisionsUseCase,
    AutoApplyProcessor,
    { provide: AUTO_APPLY_POLICIES_REPOSITORY, useClass: PrismaAutoApplyPoliciesRepository },
    { provide: AUTO_APPLY_DECISIONS_REPOSITORY, useClass: PrismaAutoApplyDecisionsRepository },
    { provide: JOBS_REPOSITORY, useClass: PrismaJobsRepository },
    { provide: JOB_APPLICATIONS_REPOSITORY, useClass: PrismaJobApplicationsRepository },
    { provide: CLOCK_PORT, useClass: SystemClock },
    { provide: ID_GENERATOR_PORT, useClass: UuidGenerator },
  ],
  exports: [
    GetPolicyUseCase,
    EvaluateAutoApplyUseCase,
  ],
})
export class AutoApplyModule {}
