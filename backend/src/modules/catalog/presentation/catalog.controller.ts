import { Controller, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ListJobsUseCase, GetJobUseCase, GetApplicationFormUseCase, ListTenantsUseCase, GetTenantUseCase } from '../application/use-cases/catalog-use-cases';

@Controller('v1')
export class CatalogController {
  constructor(
    private readonly listJobsUseCase: ListJobsUseCase,
    private readonly getJobUseCase: GetJobUseCase,
    private readonly getApplicationFormUseCase: GetApplicationFormUseCase,
    private readonly listTenantsUseCase: ListTenantsUseCase,
    private readonly getTenantUseCase: GetTenantUseCase,
  ) {}

  @Get('jobs')
  @HttpCode(HttpStatus.OK)
  async listJobs(
    @Query('tenantId') tenantId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.listJobsUseCase.execute({
      tenantId,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      status: 'PUBLISHED',
    });
  }

  @Get('jobs/:id')
  @HttpCode(HttpStatus.OK)
  async getJob(@Param('id') id: string) {
    const job = await this.getJobUseCase.execute(id);
    return {
      id: job.id,
      tenantId: job.tenantId,
      externalId: job.externalId,
      title: job.title,
      url: job.url, // Canonical URL byte-for-byte
      status: job.status,
      description: job.description,
      location: job.location,
      formSchema: job.formSchema,
      version: job.version,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  @Get('jobs/:id/application-form')
  @HttpCode(HttpStatus.OK)
  async getApplicationForm(@Param('id') id: string) {
    return this.getApplicationFormUseCase.execute(id);
  }

  @Get('tenants')
  @HttpCode(HttpStatus.OK)
  async listTenants(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.listTenantsUseCase.execute({
      isActive: true,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('tenants/:id')
  @HttpCode(HttpStatus.OK)
  async getTenant(@Param('id') id: string) {
    return this.getTenantUseCase.execute(id);
  }
}
