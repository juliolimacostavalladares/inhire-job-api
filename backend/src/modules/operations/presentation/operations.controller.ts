import { Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/presentation/guards/roles.guard';
import { Roles } from '../../auth/presentation/decorators/roles.decorator';
import { GetMetricsUseCase, ReconcilePendingJobsUseCase } from '../application/use-cases/operations-use-cases';

@Controller('v1/operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class OperationsController {
  constructor(
    private readonly getMetricsUseCase: GetMetricsUseCase,
    private readonly reconcilePendingJobsUseCase: ReconcilePendingJobsUseCase,
  ) {}

  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  async getMetrics() {
    return this.getMetricsUseCase.execute();
  }

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  async reconcile() {
    return this.reconcilePendingJobsUseCase.execute();
  }
}
