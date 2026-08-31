import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/application/ports/token-service.port';
import {
  QueueJobApplicationUseCase,
  GetApplicationUseCase,
  ListApplicationsUseCase,
  GetApplicationAttemptsUseCase,
  QueueApplicationDto,
} from '../application/use-cases/application-use-cases';
import { JobApplicationProcessor } from '../infrastructure/processors/job-application.processor';
import { IdempotencyGuard } from '@shared/infrastructure/guards/idempotency.guard';

@Controller('v1')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(
    private readonly queueJobApplicationUseCase: QueueJobApplicationUseCase,
    private readonly getApplicationUseCase: GetApplicationUseCase,
    private readonly listApplicationsUseCase: ListApplicationsUseCase,
    private readonly getApplicationAttemptsUseCase: GetApplicationAttemptsUseCase,
    private readonly _processor: JobApplicationProcessor,
  ) {}

  @Post('jobs/:jobId/applications')
  @UseGuards(IdempotencyGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async applyToJob(
    @CurrentUser() user: JwtPayload,
    @Param('jobId') jobId: string,
    @Body() body: QueueApplicationDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.queueJobApplicationUseCase.execute(user.sub, jobId, body, correlationId);
  }

  @Get('applications')
  @HttpCode(HttpStatus.OK)
  async listApplications(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.listApplicationsUseCase.execute({
      userId: user.role === 'ADMIN' ? undefined : user.sub,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('applications/:id')
  @HttpCode(HttpStatus.OK)
  async getApplication(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const app = await this.getApplicationUseCase.execute(user.sub, id, user.role === 'ADMIN');
    return {
      id: app.id,
      userId: app.userId,
      jobId: app.jobId,
      jobUrl: app.jobUrl,
      status: app.status,
      processingStep: app.processingStep,
      resumeMode: app.resumeMode,
      resumeArtifactId: app.resumeArtifactId,
      answers: app.answers,
      attemptsCount: app.attemptsCount,
      matchScore: app.matchScore,
      autoApplied: app.autoApplied,
      errorCode: app.errorCode,
      errorMessage: app.errorMessage,
      submittedAt: app.submittedAt,
      version: app.version,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      receipt: app.receipt,
    };
  }

  @Get('applications/:id/attempts')
  @HttpCode(HttpStatus.OK)
  async getAttempts(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.getApplicationAttemptsUseCase.execute(user.sub, id, user.role === 'ADMIN');
  }
}
