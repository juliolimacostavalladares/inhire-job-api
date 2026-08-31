import { Module } from '@nestjs/common';
import { CatalogController } from './presentation/catalog.controller';
import { AdminCatalogController } from './presentation/admin-catalog.controller';
import {
  ListJobsUseCase,
  GetJobUseCase,
  GetApplicationFormUseCase,
  GetApplicationSnapshotUseCase,
  UpsertTenantUseCase,
  UpsertJobUseCase,
  CloseMissingJobsUseCase,
  ListTenantsUseCase,
  GetTenantUseCase,
} from './application/use-cases/catalog-use-cases';
import { TENANTS_REPOSITORY } from './application/ports/tenants.repository';
import { JOBS_REPOSITORY } from './application/ports/jobs.repository';
import { CATALOG_SERVICE } from './application/ports/catalog-service.interface';
import { PrismaTenantsRepository } from './infrastructure/prisma-tenants.repository';
import { PrismaJobsRepository } from './infrastructure/prisma-jobs.repository';
import { CatalogFacade } from './infrastructure/catalog-facade';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CLOCK_PORT } from '@shared/domain/ports/clock.port';
import { SystemClock } from '@shared/infrastructure/clock/system-clock';
import { ID_GENERATOR_PORT } from '@shared/domain/ports/id-generator.port';
import { UuidGenerator } from '@shared/infrastructure/id-generator/uuid-generator';

@Module({
  imports: [AuthModule],
  controllers: [CatalogController, AdminCatalogController],
  providers: [
    PrismaService,
    ListJobsUseCase,
    GetJobUseCase,
    GetApplicationFormUseCase,
    GetApplicationSnapshotUseCase,
    UpsertTenantUseCase,
    UpsertJobUseCase,
    CloseMissingJobsUseCase,
    ListTenantsUseCase,
    GetTenantUseCase,
    CatalogFacade,
    { provide: TENANTS_REPOSITORY, useClass: PrismaTenantsRepository },
    { provide: JOBS_REPOSITORY, useClass: PrismaJobsRepository },
    { provide: CATALOG_SERVICE, useClass: CatalogFacade },
    { provide: CLOCK_PORT, useClass: SystemClock },
    { provide: ID_GENERATOR_PORT, useClass: UuidGenerator },
  ],
  exports: [
    CATALOG_SERVICE,
    GetJobUseCase,
    GetApplicationSnapshotUseCase,
    GetApplicationFormUseCase,
  ],
})
export class CatalogModule {}
