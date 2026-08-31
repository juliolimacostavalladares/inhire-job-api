import { Injectable, Inject } from '@nestjs/common';
import { JOB_APPLICATIONS_REPOSITORY, JobApplicationsRepository } from '../ports/job-applications.repository';
import { OFFICIAL_APPLICATION_SUBMITTER, OfficialApplicationSubmitter, ApplicationPackage } from '../ports/official-application-submitter.port';
import { CANDIDATE_PROFILE_SERVICE, CandidateProfileService } from '../../../candidate-profile/application/ports/candidate-profile-service.interface';
import { CATALOG_SERVICE, CatalogService } from '../../../catalog/application/ports/catalog-service.interface';
import { RESUME_GENERATOR, ResumeGenerator } from '../../../resume/application/ports/resume-generator.interface';
import { RESUME_ARTIFACTS_REPOSITORY, ResumeArtifactsRepository } from '../../../resume/application/ports/resume-artifacts.repository';
import { ARTIFACT_STORAGE_PORT, ArtifactStorage } from '@shared/infrastructure/storage/artifact-storage.port';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';
import { JobApplication, ResumeMode } from '../../domain/job-application.entity';
import { AppError } from '@shared/domain/errors/app-error';

export interface QueueApplicationDto {
  resumeMode?: ResumeMode;
  existingArtifactId?: string | null;
  answers?: Record<string, unknown>;
  autoApplied?: boolean;
}

@Injectable()
export class QueueJobApplicationUseCase {
  constructor(
    @Inject(JOB_APPLICATIONS_REPOSITORY) private readonly applicationsRepo: JobApplicationsRepository,
    @Inject(CANDIDATE_PROFILE_SERVICE) private readonly profileService: CandidateProfileService,
    @Inject(CATALOG_SERVICE) private readonly catalogService: CatalogService,
    private readonly bullmqService: BullMQService,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
  ) {}

  async execute(
    userId: string,
    jobId: string,
    dto: QueueApplicationDto = {},
    correlationId?: string,
  ): Promise<{ applicationId: string; status: string; location: string; correlationId?: string }> {
    // 1. Check existing application for (userId, jobId)
    const existing = await this.applicationsRepo.findByUserAndJob(userId, jobId);
    if (existing) {
      if (existing.status === 'QUEUED' || existing.status === 'PROCESSING') {
        return {
          applicationId: existing.id,
          status: existing.status,
          location: `/v1/applications/${existing.id}`,
          correlationId,
        };
      }
      throw AppError.applicationAlreadyExists(`Application already exists for job ${jobId}`);
    }

    // 2. Fetch published Job snapshot
    const jobSnapshot = await this.catalogService.getApplicationSnapshot(jobId);

    // 3. Assess candidate profile readiness
    const readiness = await this.profileService.assessReadiness(userId, 'SUBMISSION');
    if (!readiness.ready) {
      throw AppError.profileNotReady(
        'Candidate profile is missing required information for submission',
        readiness.missingFields.map((f) => ({ path: f, code: 'REQUIRED' })),
      );
    }

    const candidatePrep = await this.profileService.prepareApplicationData(userId, [
      'fullName',
      'email',
      'phone',
      'country',
      'city',
    ]);

    const resumeMode: ResumeMode = dto.resumeMode ?? 'AI_TAILORED';
    const applicationId = this.idGenerator.generate();

    // 4. Create JobApplication with exact Canonical URL copy
    const application = JobApplication.create({
      id: applicationId,
      userId,
      jobId,
      jobUrl: jobSnapshot.jobUrl, // Exact copy (ADR-008, APP-FR-03)
      resumeMode,
      resumeArtifactId: dto.existingArtifactId || undefined,
      answers: dto.answers,
      formSchemaSnapshot: jobSnapshot.formSchema,
      candidateProfileSnapshot: candidatePrep.data,
      autoApplied: dto.autoApplied ?? false,
      now: this.clock.now(),
    });

    await this.applicationsRepo.save(application);

    // 5. Enqueue BullMQ job
    await this.bullmqService.addJob(
      'job-application',
      'submit-official-application',
      {
        applicationId,
        correlationId,
      },
      `application:${applicationId}`,
    );

    // 6. Return 202 Accepted payload
    return {
      applicationId,
      status: 'QUEUED',
      location: `/v1/applications/${applicationId}`,
      correlationId,
    };
  }
}

@Injectable()
export class ProcessJobApplicationUseCase {
  constructor(
    @Inject(JOB_APPLICATIONS_REPOSITORY) private readonly applicationsRepo: JobApplicationsRepository,
    @Inject(RESUME_GENERATOR) private readonly resumeGenerator: ResumeGenerator,
    @Inject(RESUME_ARTIFACTS_REPOSITORY) private readonly artifactsRepo: ResumeArtifactsRepository,
    @Inject(ARTIFACT_STORAGE_PORT) private readonly storage: ArtifactStorage,
    @Inject(OFFICIAL_APPLICATION_SUBMITTER) private readonly submitter: OfficialApplicationSubmitter,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
    private readonly logger: SanitizedLogger,
  ) {}

  async execute(applicationId: string): Promise<JobApplication> {
    const application = await this.applicationsRepo.findById(applicationId);
    if (!application) {
      throw AppError.notFound(`Job application ${applicationId} not found`);
    }

    // Idempotent: If terminal, return without side effect (ADR-003, T-IDEM-01)
    if (application.isTerminal()) {
      return application;
    }

    const attemptId = this.idGenerator.generate();
    const ordinal = application.attempts.length + 1;
    const attemptStartedAt = this.clock.now();

    try {
      // Step 1: PREPARING_DATA
      application.startProcessing('PREPARING_DATA', attemptStartedAt);
      await this.applicationsRepo.save(application);

      // Validate URL HTTPS allowlist
      try {
        const url = new URL(application.jobUrl);
        const host = url.hostname.toLowerCase();
        const isAllowed = host === 'inhire.app' || host.endsWith('.inhire.app') || host === 'localhost' || host === '127.0.0.1';
        if (url.protocol !== 'https:' || !isAllowed) {
          throw AppError.jobUrlNotAllowed(`Job URL host '${host}' not allowed`);
        }
      } catch (err: unknown) {
        application.markFailed('JOB_URL_NOT_ALLOWED', 'Job URL is invalid or outside allowed domain', this.clock.now());
        await this.applicationsRepo.save(application);
        await this.applicationsRepo.addAttempt({
          id: attemptId,
          applicationId: application.id,
          ordinal,
          step: 'PREPARING_DATA',
          outcome: 'PERMANENT_FAILURE',
          errorCode: 'JOB_URL_NOT_ALLOWED',
          startedAt: attemptStartedAt,
          finishedAt: this.clock.now(),
        });
        return application;
      }

      // Step 2: GENERATING_RESUME (if AI_TAILORED) or load existing
      application.updateStep('GENERATING_RESUME', this.clock.now());
      await this.applicationsRepo.save(application);

      let resumeArtifactDto: {
        artifactId: string;
        fileName: string;
        mimeType: string;
        checksum: string;
        buffer: Buffer;
      };

      if (application.resumeMode === 'AI_TAILORED') {
        const generated = await this.resumeGenerator.ensureReady({
          userId: application.userId,
          jobId: application.jobId,
          applicationId: application.id,
        });

        application.setResumeArtifact(generated.artifactId, this.clock.now());
        await this.applicationsRepo.save(application);

        resumeArtifactDto = {
          artifactId: generated.artifactId,
          fileName: 'curriculo.pdf',
          mimeType: generated.mimeType,
          checksum: generated.sha256Checksum,
          buffer: generated.pdfBuffer,
        };
      } else {
        if (!application.resumeArtifactId) {
          throw AppError.resumeArtifactInvalid('No resume artifact ID provided for EXISTING mode');
        }
        const artifact = await this.artifactsRepo.findById(application.resumeArtifactId);
        if (!artifact || artifact.userId !== application.userId) {
          throw AppError.resumeArtifactInvalid('Existing resume artifact not found or unauthorized');
        }
        const buffer = await this.storage.download(artifact.storageKey);
        resumeArtifactDto = {
          artifactId: artifact.id,
          fileName: artifact.fileName,
          mimeType: artifact.mimeType,
          checksum: artifact.sha256Checksum,
          buffer,
        };
      }

      // Step 3: SUBMITTING
      application.updateStep('SUBMITTING', this.clock.now());
      await this.applicationsRepo.save(application);

      const pkg: ApplicationPackage = {
        applicationId: application.id,
        jobUrl: application.jobUrl, // Exact copy
        candidateData: (application.candidateProfileSnapshot as Record<string, unknown>) || {},
        answers: application.answers || {},
        formSchema: (application.formSchemaSnapshot as unknown as []) || [],
        resume: resumeArtifactDto,
      };

      const outcomeResult = await this.submitter.submit(pkg);

      // Handle outcomes
      if (outcomeResult.outcome === 'SUCCEEDED' && outcomeResult.receiptDetails) {
        const receiptProps = {
          id: this.idGenerator.generate(),
          applicationId: application.id,
          attemptId,
          endpointFingerprint: outcomeResult.receiptDetails.endpointFingerprint,
          responseStatus: outcomeResult.receiptDetails.responseStatus,
          confirmationFingerprint: outcomeResult.receiptDetails.confirmationFingerprint,
          artifactChecksum: outcomeResult.receiptDetails.artifactChecksum,
          externalRequestId: outcomeResult.receiptDetails.externalRequestId || null,
          submittedAt: this.clock.now(),
        };

        await this.applicationsRepo.saveReceipt(receiptProps);
        application.markSubmitted(receiptProps, this.clock.now());
        await this.applicationsRepo.save(application);

        await this.applicationsRepo.addAttempt({
          id: attemptId,
          applicationId: application.id,
          ordinal,
          step: 'SUBMITTING',
          outcome: 'SUCCEEDED',
          startedAt: attemptStartedAt,
          finishedAt: this.clock.now(),
        });

        this.logger.log({
          operation: 'application_submitted_successfully',
          applicationId: application.id,
          jobId: application.jobId,
        }, 'ProcessJobApplicationUseCase');

        return application;
      } else if (outcomeResult.outcome === 'MANUAL_ACTION_REQUIRED' || outcomeResult.outcome === 'OUTCOME_UNKNOWN') {
        application.markRequiresManualAction(
          outcomeResult.errorCode || 'MANUAL_ACTION_REQUIRED',
          outcomeResult.errorMessage || 'Manual intervention required',
          this.clock.now(),
        );
        await this.applicationsRepo.save(application);

        await this.applicationsRepo.addAttempt({
          id: attemptId,
          applicationId: application.id,
          ordinal,
          step: 'SUBMITTING',
          outcome: outcomeResult.outcome,
          errorCode: outcomeResult.errorCode,
          errorMessage: outcomeResult.errorMessage,
          evidenceRef: outcomeResult.evidenceRef,
          startedAt: attemptStartedAt,
          finishedAt: this.clock.now(),
        });

        return application;
      } else if (outcomeResult.outcome === 'PERMANENT_FAILURE') {
        application.markFailed(
          outcomeResult.errorCode || 'PERMANENT_FAILURE',
          outcomeResult.errorMessage || 'Permanent failure',
          this.clock.now(),
        );
        await this.applicationsRepo.save(application);

        await this.applicationsRepo.addAttempt({
          id: attemptId,
          applicationId: application.id,
          ordinal,
          step: 'SUBMITTING',
          outcome: 'PERMANENT_FAILURE',
          errorCode: outcomeResult.errorCode,
          errorMessage: outcomeResult.errorMessage,
          startedAt: attemptStartedAt,
          finishedAt: this.clock.now(),
        });

        return application;
      } else {
        // RETRYABLE_FAILURE
        await this.applicationsRepo.addAttempt({
          id: attemptId,
          applicationId: application.id,
          ordinal,
          step: 'SUBMITTING',
          outcome: 'RETRYABLE_FAILURE',
          errorCode: outcomeResult.errorCode || 'EXTERNAL_UNAVAILABLE',
          errorMessage: outcomeResult.errorMessage,
          startedAt: attemptStartedAt,
          finishedAt: this.clock.now(),
        });

        throw AppError.externalUnavailable(outcomeResult.errorMessage || 'Submission failed temporarily');
      }
    } catch (err: unknown) {
      if (application.isTerminal()) {
        return application;
      }
      const error = err as Error;
      this.logger.error({
        operation: 'process_application_error',
        applicationId: application.id,
        error: error.message,
      }, error.stack, 'ProcessJobApplicationUseCase');

      throw err;
    }
  }
}

@Injectable()
export class GetApplicationUseCase {
  constructor(@Inject(JOB_APPLICATIONS_REPOSITORY) private readonly applicationsRepo: JobApplicationsRepository) {}

  async execute(userId: string, applicationId: string, isAdmin = false): Promise<JobApplication> {
    const app = await this.applicationsRepo.findById(applicationId);
    if (!app) {
      throw AppError.notFound(`Job application ${applicationId} not found`);
    }
    if (!isAdmin && app.userId !== userId) {
      throw AppError.notFound(`Job application ${applicationId} not found`);
    }
    return app;
  }
}

@Injectable()
export class ListApplicationsUseCase {
  constructor(@Inject(JOB_APPLICATIONS_REPOSITORY) private readonly applicationsRepo: JobApplicationsRepository) {}

  async execute(filter?: { userId?: string; status?: string; page?: number; limit?: number }) {
    return this.applicationsRepo.findAll(filter);
  }
}

@Injectable()
export class GetApplicationAttemptsUseCase {
  constructor(private readonly getApplicationUseCase: GetApplicationUseCase) {}

  async execute(userId: string, applicationId: string, isAdmin = false) {
    const app = await this.getApplicationUseCase.execute(userId, applicationId, isAdmin);
    return app.attempts;
  }
}

@Injectable()
export class RetryApplicationUseCase {
  constructor(
    @Inject(JOB_APPLICATIONS_REPOSITORY) private readonly applicationsRepo: JobApplicationsRepository,
    private readonly bullmqService: BullMQService,
  ) {}

  async execute(applicationId: string, reason: string): Promise<{ applicationId: string; status: string }> {
    const application = await this.applicationsRepo.findById(applicationId);
    if (!application) {
      throw AppError.notFound(`Job application ${applicationId} not found`);
    }

    // OPS-AC-02: Retry de candidatura SUBMITTED é expressamente recusado!
    if (application.status === 'SUBMITTED') {
      throw AppError.invalidStateTransition('Cannot retry an already SUBMITTED application');
    }

    application.startProcessing('PREPARING_DATA', new Date());
    await this.applicationsRepo.save(application);

    await this.bullmqService.addJob(
      'job-application',
      'submit-official-application',
      {
        applicationId: application.id,
      },
      `application:${application.id}`,
    );

    return { applicationId: application.id, status: 'QUEUED' };
  }
}
