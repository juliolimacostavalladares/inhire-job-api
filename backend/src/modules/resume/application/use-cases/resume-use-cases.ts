import { Injectable, Inject } from '@nestjs/common';
import { TAILORED_RESUMES_REPOSITORY, TailoredResumesRepository } from '../ports/tailored-resumes.repository';
import { RESUME_ARTIFACTS_REPOSITORY, ResumeArtifactsRepository } from '../ports/resume-artifacts.repository';
import { AI_PROVIDER, AiProvider } from '../ports/ai-provider.port';
import { PDF_RENDERER, PdfRenderer } from '../ports/pdf-renderer.port';
import { RESUME_GENERATOR, ResumeGenerator, ResumeArtifactDto } from '../ports/resume-generator.interface';
import { CANDIDATE_PROFILE_SERVICE, CandidateProfileService } from '../../../candidate-profile/application/ports/candidate-profile-service.interface';
import { CATALOG_SERVICE, CatalogService } from '../../../catalog/application/ports/catalog-service.interface';
import { ARTIFACT_STORAGE_PORT, ArtifactStorage } from '@shared/infrastructure/storage/artifact-storage.port';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { TailoredResume } from '../../domain/tailored-resume.entity';
import { ResumeArtifact } from '../../domain/resume-artifact.entity';
import { AppError } from '@shared/domain/errors/app-error';

@Injectable()
export class RequestResumeGenerationUseCase {
  constructor(
    @Inject(TAILORED_RESUMES_REPOSITORY) private readonly resumesRepo: TailoredResumesRepository,
    @Inject(CANDIDATE_PROFILE_SERVICE) private readonly profileService: CandidateProfileService,
    @Inject(CATALOG_SERVICE) private readonly catalogService: CatalogService,
    private readonly bullmqService: BullMQService,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
  ) {}

  async execute(userId: string, jobId: string, correlationId?: string): Promise<{ generationId: string; status: string; location: string }> {
    const profile = await this.profileService.getProfile(userId);
    const job = await this.catalogService.getApplicationSnapshot(jobId);

    const readiness = await this.profileService.assessReadiness(userId, 'TAILORED_RESUME');
    if (!readiness.ready) {
      throw AppError.profileNotReady(
        'Candidate profile is missing required information for tailored resume generation',
        readiness.missingFields.map((f) => ({ path: f, code: 'REQUIRED' })),
      );
    }

    const templateVersion = 1;
    let resume = await this.resumesRepo.findByVersions(userId, jobId, profile.version, job.version, templateVersion);

    if (!resume) {
      resume = TailoredResume.create({
        id: this.idGenerator.generate(),
        userId,
        jobId,
        profileVersion: profile.version,
        jobVersion: job.version,
        templateVersion,
        now: this.clock.now(),
      });
      await this.resumesRepo.save(resume);
    } else if (resume.status === 'READY') {
      return {
        generationId: resume.id,
        status: resume.status,
        location: `/v1/resume-generations/${resume.id}`,
      };
    }

    await this.bullmqService.addJob(
      'resume-generation',
      'generate-tailored-resume',
      {
        generationId: resume.id,
        userId,
        jobId,
        correlationId,
      },
      `resume:${resume.id}`,
    );

    return {
      generationId: resume.id,
      status: resume.status,
      location: `/v1/resume-generations/${resume.id}`,
    };
  }
}

@Injectable()
export class ProcessResumeGenerationUseCase {
  constructor(
    @Inject(TAILORED_RESUMES_REPOSITORY) private readonly resumesRepo: TailoredResumesRepository,
    @Inject(RESUME_ARTIFACTS_REPOSITORY) private readonly artifactsRepo: ResumeArtifactsRepository,
    @Inject(CANDIDATE_PROFILE_SERVICE) private readonly profileService: CandidateProfileService,
    @Inject(CATALOG_SERVICE) private readonly catalogService: CatalogService,
    @Inject(AI_PROVIDER) private readonly aiProvider: AiProvider,
    @Inject(PDF_RENDERER) private readonly pdfRenderer: PdfRenderer,
    @Inject(ARTIFACT_STORAGE_PORT) private readonly storage: ArtifactStorage,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
    private readonly logger: SanitizedLogger,
  ) {}

  async execute(generationId: string, userId: string, jobId: string): Promise<TailoredResume> {
    const resume = await this.resumesRepo.findById(generationId);
    if (!resume) {
      throw AppError.notFound(`Resume generation ${generationId} not found`);
    }

    if (resume.status === 'READY') {
      return resume; // Idempotent
    }

    const attemptId = this.idGenerator.generate();
    const ordinal = resume.attempts.length + 1;
    const now = this.clock.now();

    try {
      resume.markGenerating(now);
      await this.resumesRepo.save(resume);

      const profile = await this.profileService.getProfile(userId);
      const jobSnapshot = await this.catalogService.getApplicationSnapshot(jobId);

      // 1. AI tailored content generation
      const contentResult = await this.aiProvider.generateTailoredContent(profile, jobSnapshot);

      resume.markRendering(contentResult.matchScore, contentResult.matchSummary, this.clock.now());
      await this.resumesRepo.save(resume);

      // 2. Render to valid PDF
      const pdfBuffer = await this.pdfRenderer.renderToPdf(profile, contentResult);

      // Validate PDF format
      if (pdfBuffer.length === 0 || pdfBuffer.subarray(0, 4).toString() !== '%PDF') {
        throw AppError.resumeArtifactInvalid('Rendered PDF is empty or invalid format');
      }

      // 3. Save to object storage
      const artifactId = this.idGenerator.generate();
      const storageKey = `resumes/${userId}/${artifactId}.pdf`;
      const stored = await this.storage.upload(storageKey, pdfBuffer, 'application/pdf');

      // 4. Save artifact record
      const artifact = ResumeArtifact.create({
        id: artifactId,
        userId,
        storageKey: stored.key,
        fileName: `curriculo-${profile.fullName || 'candidato'}.pdf`,
        mimeType: 'application/pdf',
        fileSize: stored.size,
        sha256Checksum: stored.checksum,
        now: this.clock.now(),
      });
      await this.artifactsRepo.save(artifact);

      // 5. Mark tailored resume ready
      resume.markReady(artifactId, this.clock.now());
      await this.resumesRepo.save(resume);

      await this.resumesRepo.addAttempt({
        id: attemptId,
        tailoredResumeId: resume.id,
        ordinal,
        status: 'SUCCEEDED',
        startedAt: now,
        finishedAt: this.clock.now(),
      });

      this.logger.log({
        operation: 'resume_generation_succeeded',
        generationId,
        artifactId,
        matchScore: contentResult.matchScore,
      }, 'ProcessResumeGenerationUseCase');

      return resume;
    } catch (err: unknown) {
      const error = err as Error;
      resume.markFailed(error.message || 'GENERATION_FAILED', this.clock.now());
      await this.resumesRepo.save(resume);

      await this.resumesRepo.addAttempt({
        id: attemptId,
        tailoredResumeId: resume.id,
        ordinal,
        status: 'FAILED',
        errorCode: 'GENERATION_FAILED',
        startedAt: now,
        finishedAt: this.clock.now(),
      });

      this.logger.error({
        operation: 'resume_generation_failed',
        generationId,
        error: error.message,
      }, error.stack, 'ProcessResumeGenerationUseCase');

      throw err;
    }
  }
}

@Injectable()
export class EnsureReadyResumeUseCase implements ResumeGenerator {
  constructor(
    @Inject(TAILORED_RESUMES_REPOSITORY) private readonly resumesRepo: TailoredResumesRepository,
    @Inject(RESUME_ARTIFACTS_REPOSITORY) private readonly artifactsRepo: ResumeArtifactsRepository,
    @Inject(CANDIDATE_PROFILE_SERVICE) private readonly profileService: CandidateProfileService,
    @Inject(CATALOG_SERVICE) private readonly catalogService: CatalogService,
    @Inject(ARTIFACT_STORAGE_PORT) private readonly storage: ArtifactStorage,
    private readonly requestUseCase: RequestResumeGenerationUseCase,
    private readonly processUseCase: ProcessResumeGenerationUseCase,
  ) {}

  async ensureReady(input: { userId: string; jobId: string; applicationId?: string }): Promise<ResumeArtifactDto> {
    const profile = await this.profileService.getProfile(input.userId);
    const job = await this.catalogService.getApplicationSnapshot(input.jobId);

    let resume = await this.resumesRepo.findByVersions(input.userId, input.jobId, profile.version, job.version, 1);

    if (!resume || resume.status !== 'READY' || !resume.resumeArtifactId) {
      // Trigger request and process synchronously within the worker job
      const req = await this.requestUseCase.execute(input.userId, input.jobId);
      resume = await this.processUseCase.execute(req.generationId, input.userId, input.jobId);
    }

    if (!resume.resumeArtifactId) {
      throw AppError.resumeGenerationFailed('Tailored resume did not produce an artifact ID');
    }

    const artifact = await this.artifactsRepo.findById(resume.resumeArtifactId);
    if (!artifact) {
      throw AppError.resumeArtifactInvalid(`Artifact ${resume.resumeArtifactId} not found`);
    }

    const pdfBuffer = await this.storage.download(artifact.storageKey);

    return {
      artifactId: artifact.id,
      key: artifact.storageKey,
      mimeType: artifact.mimeType,
      fileSize: artifact.fileSize,
      sha256Checksum: artifact.sha256Checksum,
      pdfBuffer,
    };
  }
}

@Injectable()
export class GetResumeByJobUseCase {
  constructor(@Inject(TAILORED_RESUMES_REPOSITORY) private readonly resumesRepo: TailoredResumesRepository) {}

  async execute(userId: string, jobId: string): Promise<TailoredResume> {
    const resume = await this.resumesRepo.findLatestByJobAndUser(userId, jobId);
    if (!resume) {
      // RES-FR-08: Ausência sem pedido retorna RESUME_NOT_STARTED (404), nunca FAILED
      throw AppError.resumeNotStarted('No tailored resume has been generated for this job yet');
    }
    return resume;
  }
}

@Injectable()
export class GetResumeGenerationUseCase {
  constructor(@Inject(TAILORED_RESUMES_REPOSITORY) private readonly resumesRepo: TailoredResumesRepository) {}

  async execute(userId: string, generationId: string): Promise<TailoredResume> {
    const resume = await this.resumesRepo.findById(generationId);
    if (!resume || resume.userId !== userId) {
      throw AppError.notFound(`Resume generation ${generationId} not found`);
    }
    return resume;
  }
}

@Injectable()
export class DownloadResumeArtifactUseCase {
  constructor(
    @Inject(RESUME_ARTIFACTS_REPOSITORY) private readonly artifactsRepo: ResumeArtifactsRepository,
    @Inject(ARTIFACT_STORAGE_PORT) private readonly storage: ArtifactStorage,
  ) {}

  async execute(userId: string, artifactId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const artifact = await this.artifactsRepo.findById(artifactId);
    if (!artifact || artifact.userId !== userId) {
      throw AppError.notFound(`Resume artifact ${artifactId} not found`);
    }
    const buffer = await this.storage.download(artifact.storageKey);
    return {
      buffer,
      fileName: artifact.fileName,
      mimeType: artifact.mimeType,
    };
  }
}
