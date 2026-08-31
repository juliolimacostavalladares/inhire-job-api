import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { CandidateProfileModule } from './modules/candidate-profile/candidate-profile.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { AcquisitionModule } from './modules/acquisition/acquisition.module';
import { ResumeModule } from './modules/resume/resume.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AutoApplyModule } from './modules/auto-apply/auto-apply.module';
import { OperationsModule } from './modules/operations/operations.module';
import { PrismaService } from './shared/infrastructure/prisma/prisma.service';
import { BullMQService } from './shared/infrastructure/bullmq/bullmq.service';
import { SanitizedLogger } from './shared/infrastructure/logger/sanitized-logger.service';

@Module({
  imports: [
    AuthModule,
    CandidateProfileModule,
    CatalogModule,
    AcquisitionModule,
    ResumeModule,
    ApplicationsModule,
    AutoApplyModule,
    OperationsModule,
  ],
  providers: [
    PrismaService,
    BullMQService,
    SanitizedLogger,
  ],
})
export class WorkerModule {}
