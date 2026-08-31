import { Controller, Post, Get, Param, UseGuards, HttpCode, HttpStatus, Headers, Res } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/application/ports/token-service.port';
import {
  RequestResumeGenerationUseCase,
  GetResumeByJobUseCase,
  GetResumeGenerationUseCase,
  DownloadResumeArtifactUseCase,
} from '../application/use-cases/resume-use-cases';
import { ResumeGenerationProcessor } from '../infrastructure/processors/resume-generation.processor';
import { IdempotencyGuard } from '@shared/infrastructure/guards/idempotency.guard';

@Controller('v1')
@UseGuards(JwtAuthGuard)
export class ResumeController {
  constructor(
    private readonly requestResumeGenerationUseCase: RequestResumeGenerationUseCase,
    private readonly getResumeByJobUseCase: GetResumeByJobUseCase,
    private readonly getResumeGenerationUseCase: GetResumeGenerationUseCase,
    private readonly downloadResumeArtifactUseCase: DownloadResumeArtifactUseCase,
    private readonly _processor: ResumeGenerationProcessor,
  ) {}

  @Post('jobs/:jobId/resumes')
  @UseGuards(IdempotencyGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async requestResume(
    @CurrentUser() user: JwtPayload,
    @Param('jobId') jobId: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.requestResumeGenerationUseCase.execute(user.sub, jobId, correlationId);
  }

  @Get('jobs/:jobId/resume')
  @HttpCode(HttpStatus.OK)
  async getResumeByJob(@CurrentUser() user: JwtPayload, @Param('jobId') jobId: string) {
    const resume = await this.getResumeByJobUseCase.execute(user.sub, jobId);
    return {
      id: resume.id,
      userId: resume.userId,
      jobId: resume.jobId,
      status: resume.status,
      matchScore: resume.matchScore,
      matchSummary: resume.matchSummary,
      resumeArtifactId: resume.resumeArtifactId,
      errorCode: resume.errorCode,
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
    };
  }

  @Get('resume-generations/:id')
  @HttpCode(HttpStatus.OK)
  async getResumeGeneration(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const resume = await this.getResumeGenerationUseCase.execute(user.sub, id);
    return {
      id: resume.id,
      userId: resume.userId,
      jobId: resume.jobId,
      status: resume.status,
      matchScore: resume.matchScore,
      matchSummary: resume.matchSummary,
      resumeArtifactId: resume.resumeArtifactId,
      errorCode: resume.errorCode,
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
      attempts: resume.attempts,
    };
  }

  @Get('resume-artifacts/:id/content')
  async downloadArtifact(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.downloadResumeArtifactUseCase.execute(user.sub, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.buffer);
  }
}
