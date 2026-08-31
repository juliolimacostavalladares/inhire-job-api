import { Controller, Post, Put, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { UpsertTenantUseCase, UpsertJobUseCase } from '../application/use-cases/catalog-use-cases';
import { FormFieldSchema } from '../domain/job.entity';

@Controller('v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCatalogController {
  constructor(
    private readonly upsertTenantUseCase: UpsertTenantUseCase,
    private readonly upsertJobUseCase: UpsertJobUseCase,
  ) {}

  @Post('tenants')
  @HttpCode(HttpStatus.CREATED)
  async createTenant(@Body() body: { slug: string; name: string; officialUrl: string }) {
    const tenant = await this.upsertTenantUseCase.execute(body);
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      officialUrl: tenant.officialUrl,
      isActive: tenant.isActive,
      lastCollectedAt: tenant.lastCollectedAt,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  @Put('tenants/:id')
  @HttpCode(HttpStatus.OK)
  async updateTenant(@Param('id') id: string, @Body() body: { slug: string; name: string; officialUrl: string; isActive?: boolean }) {
    const tenant = await this.upsertTenantUseCase.execute(body);
    return {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      officialUrl: tenant.officialUrl,
      isActive: tenant.isActive,
      lastCollectedAt: tenant.lastCollectedAt,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  @Post('jobs')
  @HttpCode(HttpStatus.CREATED)
  async createJob(@Body() body: {
    tenantId: string;
    externalId: string;
    title: string;
    url: string;
    description: string;
    location?: string;
    formSchema?: FormFieldSchema[];
  }) {
    const job = await this.upsertJobUseCase.execute(body);
    return {
      id: job.id,
      tenantId: job.tenantId,
      externalId: job.externalId,
      title: job.title,
      url: job.url,
      status: job.status,
      description: job.description,
      location: job.location,
      formSchema: job.formSchema,
      version: job.version,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}
