import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/presentation/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/presentation/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/application/ports/token-service.port';
import { GetProfileUseCase } from '../application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase, UpdateProfileDto } from '../application/use-cases/update-profile.use-case';
import { ImportProfileUseCase } from '../application/use-cases/import-profile.use-case';
import { GetImportAttemptUseCase } from '../application/use-cases/get-import-attempt.use-case';
import { AssessReadinessUseCase } from '../application/use-cases/assess-readiness.use-case';
import { IdempotencyGuard } from '@shared/infrastructure/guards/idempotency.guard';

@Controller('v1/me')
@UseGuards(JwtAuthGuard)
export class CandidateProfileController {
  constructor(
    private readonly getProfileUseCase: GetProfileUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly importProfileUseCase: ImportProfileUseCase,
    private readonly getImportAttemptUseCase: GetImportAttemptUseCase,
    private readonly assessReadinessUseCase: AssessReadinessUseCase,
  ) {}

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: JwtPayload) {
    const profile = await this.getProfileUseCase.execute(user.sub);
    return {
      id: profile.id,
      userId: profile.userId,
      status: profile.status,
      version: profile.version,
      fullName: profile.fullName,
      headline: profile.headline,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      experiences: profile.experiences,
      education: profile.education,
      skills: profile.skills,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  @Put('profile')
  @UseGuards(IdempotencyGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(@CurrentUser() user: JwtPayload, @Body() body: UpdateProfileDto) {
    const profile = await this.updateProfileUseCase.execute(user.sub, body);
    return {
      id: profile.id,
      userId: profile.userId,
      status: profile.status,
      version: profile.version,
      fullName: profile.fullName,
      headline: profile.headline,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      experiences: profile.experiences,
      education: profile.education,
      skills: profile.skills,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  @Patch('profile')
  @UseGuards(IdempotencyGuard)
  @HttpCode(HttpStatus.OK)
  async patchProfile(@CurrentUser() user: JwtPayload, @Body() body: UpdateProfileDto) {
    const profile = await this.updateProfileUseCase.execute(user.sub, body);
    return {
      id: profile.id,
      userId: profile.userId,
      status: profile.status,
      version: profile.version,
      fullName: profile.fullName,
      headline: profile.headline,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      experiences: profile.experiences,
      education: profile.education,
      skills: profile.skills,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  @Post('profile/imports')
  @UseGuards(IdempotencyGuard)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.ACCEPTED)
  async importProfile(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: { base64Pdf?: string; fileContent?: string },
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    let rawData: Buffer;
    let mimeType = 'application/pdf';

    if (file && file.buffer) {
      rawData = file.buffer;
      mimeType = file.mimetype || 'application/pdf';
    } else if (body?.base64Pdf) {
      rawData = Buffer.from(body.base64Pdf, 'base64');
    } else if (body?.fileContent) {
      rawData = Buffer.from(body.fileContent);
    } else {
      rawData = Buffer.from('%PDF-1.4 empty resume');
    }

    const result = await this.importProfileUseCase.execute(user.sub, rawData, mimeType, correlationId);
    return {
      importId: result.importId,
      attemptId: result.importId,
      status: result.status,
      location: result.location,
    };
  }

  @Get('profile/imports/:id')
  @HttpCode(HttpStatus.OK)
  async getImportAttempt(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.getImportAttemptUseCase.execute(user.sub, id);
  }

  @Get('profile/readiness')
  @HttpCode(HttpStatus.OK)
  async assessReadiness(
    @CurrentUser() user: JwtPayload,
    @Query('purpose') purpose: 'SUBMISSION' | 'TAILORED_RESUME' = 'SUBMISSION',
  ) {
    return this.assessReadinessUseCase.execute(user.sub, purpose);
  }
}
