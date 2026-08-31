import { Controller, Post, Get, Param, Query, Body, UseGuards, HttpCode, HttpStatus, Headers } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import {
  CreateDiscoveryRunUseCase,
  CreateCollectionRunUseCase,
  ListRunsUseCase,
  GetRunUseCase,
} from '../application/use-cases/acquisition-use-cases';

@Controller('v1/runs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AcquisitionController {
  constructor(
    private readonly createDiscoveryRunUseCase: CreateDiscoveryRunUseCase,
    private readonly createCollectionRunUseCase: CreateCollectionRunUseCase,
    private readonly listRunsUseCase: ListRunsUseCase,
    private readonly getRunUseCase: GetRunUseCase,
  ) {}

  @Post('discovery')
  @HttpCode(HttpStatus.ACCEPTED)
  async startDiscovery(@Headers('x-correlation-id') correlationId?: string) {
    return this.createDiscoveryRunUseCase.execute('ADMIN_MANUAL', correlationId);
  }

  @Post('collection')
  @HttpCode(HttpStatus.ACCEPTED)
  async startCollection(
    @Body() body?: { tenantId?: string },
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.createCollectionRunUseCase.execute('ADMIN_MANUAL', body?.tenantId, correlationId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listRuns(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.listRunsUseCase.execute({
      type,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getRun(@Param('id') id: string) {
    const run = await this.getRunUseCase.execute(id);
    return {
      id: run.id,
      type: run.type,
      trigger: run.trigger,
      status: run.status,
      totalTenants: run.totalTenants,
      processedTenants: run.processedTenants,
      totalJobsFound: run.totalJobsFound,
      errorCode: run.errorCode,
      errorMessage: run.errorMessage,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      items: run.items,
    };
  }
}
