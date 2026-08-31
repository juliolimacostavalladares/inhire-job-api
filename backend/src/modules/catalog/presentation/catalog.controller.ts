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
    @Query('tenantSlug') tenantSlug?: string,
    @Query('search') search?: string,
    @Query('q') q?: string,
    @Query('title') title?: string,
    @Query('workplaceType') workplaceType?: string,
    @Query('contractType') contractType?: string,
    @Query('location') location?: string,
    @Query('tags') tags?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedTags = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
    return this.listJobsUseCase.execute({
      tenantId,
      tenantSlug,
      search: search || q,
      title,
      workplaceType,
      contractType,
      location,
      tags: parsedTags,
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
      workplaceType: job.workplaceType,
      contractType: job.contractType,
      tags: job.tags,
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
    @Query('search') search?: string,
  ) {
    return this.listTenantsUseCase.execute({
      isActive: true,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 100,
    });
  }

  @Get('tenants/:idOrSlug')
  @HttpCode(HttpStatus.OK)
  async getTenant(@Param('idOrSlug') idOrSlug: string) {
    return this.getTenantUseCase.execute(idOrSlug);
  }

  @Get('tenants/:idOrSlug/jobs')
  @HttpCode(HttpStatus.OK)
  async listTenantJobs(
    @Param('idOrSlug') idOrSlug: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('q') q?: string,
    @Query('title') title?: string,
    @Query('workplaceType') workplaceType?: string,
    @Query('contractType') contractType?: string,
    @Query('location') location?: string,
    @Query('tags') tags?: string,
  ) {
    const parsedTags = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
    return this.listJobsUseCase.execute({
      tenantSlug: idOrSlug,
      tenantId: idOrSlug,
      search: search || q,
      title,
      workplaceType,
      contractType,
      location,
      tags: parsedTags,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      status: 'PUBLISHED',
    });
  }
}
