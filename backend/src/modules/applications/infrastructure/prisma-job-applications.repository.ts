import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { JobApplicationsRepository } from '../application/ports/job-applications.repository';
import {
  JobApplication,
  ApplicationStatus,
  ProcessingStep,
  ResumeMode,
  ApplicationAttemptProps,
  SubmissionReceiptProps,
} from '../domain/job-application.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaJobApplicationsRepository implements JobApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<JobApplication | null> {
    const record = await this.prisma.jobApplication.findUnique({
      where: { id },
      include: { attempts: true, receipt: true },
    });
    if (!record) return null;

    return new JobApplication({
      id: record.id,
      userId: record.userId,
      jobId: record.jobId,
      jobUrl: record.jobUrl,
      status: record.status as ApplicationStatus,
      processingStep: record.processingStep as ProcessingStep | null,
      resumeMode: record.resumeMode as ResumeMode,
      resumeArtifactId: record.resumeArtifactId,
      answers: record.answers as Record<string, unknown> | null,
      formSchemaSnapshot: record.formSchemaSnapshot,
      candidateProfileSnapshot: record.candidateProfileSnapshot,
      attemptsCount: record.attemptsCount,
      matchScore: record.matchScore,
      autoApplied: record.autoApplied,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      submittedAt: record.submittedAt,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      attempts: record.attempts.map((a) => ({
        id: a.id,
        applicationId: a.applicationId,
        ordinal: a.ordinal,
        step: a.step,
        outcome: a.outcome,
        errorCode: a.errorCode,
        errorMessage: a.errorMessage,
        evidenceRef: a.evidenceRef,
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
      })),
      receipt: record.receipt
        ? {
            id: record.receipt.id,
            applicationId: record.receipt.applicationId,
            attemptId: record.receipt.attemptId,
            endpointFingerprint: record.receipt.endpointFingerprint,
            responseStatus: record.receipt.responseStatus,
            confirmationFingerprint: record.receipt.confirmationFingerprint,
            artifactChecksum: record.receipt.artifactChecksum,
            externalRequestId: record.receipt.externalRequestId,
            submittedAt: record.receipt.submittedAt,
          }
        : null,
    });
  }

  async findByUserAndJob(userId: string, jobId: string): Promise<JobApplication | null> {
    const record = await this.prisma.jobApplication.findUnique({
      where: {
        userId_jobId: { userId, jobId },
      },
      include: { attempts: true, receipt: true },
    });
    if (!record) return null;

    return new JobApplication({
      id: record.id,
      userId: record.userId,
      jobId: record.jobId,
      jobUrl: record.jobUrl,
      status: record.status as ApplicationStatus,
      processingStep: record.processingStep as ProcessingStep | null,
      resumeMode: record.resumeMode as ResumeMode,
      resumeArtifactId: record.resumeArtifactId,
      answers: record.answers as Record<string, unknown> | null,
      formSchemaSnapshot: record.formSchemaSnapshot,
      candidateProfileSnapshot: record.candidateProfileSnapshot,
      attemptsCount: record.attemptsCount,
      matchScore: record.matchScore,
      autoApplied: record.autoApplied,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      submittedAt: record.submittedAt,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      attempts: record.attempts.map((a) => ({
        id: a.id,
        applicationId: a.applicationId,
        ordinal: a.ordinal,
        step: a.step,
        outcome: a.outcome,
        errorCode: a.errorCode,
        errorMessage: a.errorMessage,
        evidenceRef: a.evidenceRef,
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
      })),
      receipt: record.receipt
        ? {
            id: record.receipt.id,
            applicationId: record.receipt.applicationId,
            attemptId: record.receipt.attemptId,
            endpointFingerprint: record.receipt.endpointFingerprint,
            responseStatus: record.receipt.responseStatus,
            confirmationFingerprint: record.receipt.confirmationFingerprint,
            artifactChecksum: record.receipt.artifactChecksum,
            externalRequestId: record.receipt.externalRequestId,
            submittedAt: record.receipt.submittedAt,
          }
        : null,
    });
  }

  async findAll(filter?: { userId?: string; status?: string; page?: number; limit?: number }): Promise<{ items: JobApplication[]; total: number }> {
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.JobApplicationWhereInput = {};
    if (filter?.userId) where.userId = filter.userId;
    if (filter?.status) where.status = filter.status;

    const [records, total] = await Promise.all([
      this.prisma.jobApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { attempts: true, receipt: true },
      }),
      this.prisma.jobApplication.count({ where }),
    ]);

    return {
      items: records.map(
        (r) =>
          new JobApplication({
            id: r.id,
            userId: r.userId,
            jobId: r.jobId,
            jobUrl: r.jobUrl,
            status: r.status as ApplicationStatus,
            processingStep: r.processingStep as ProcessingStep | null,
            resumeMode: r.resumeMode as ResumeMode,
            resumeArtifactId: r.resumeArtifactId,
            answers: r.answers as Record<string, unknown> | null,
            formSchemaSnapshot: r.formSchemaSnapshot,
            candidateProfileSnapshot: r.candidateProfileSnapshot,
            attemptsCount: r.attemptsCount,
            matchScore: r.matchScore,
            autoApplied: r.autoApplied,
            errorCode: r.errorCode,
            errorMessage: r.errorMessage,
            submittedAt: r.submittedAt,
            version: r.version,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            attempts: r.attempts.map((a) => ({
              id: a.id,
              applicationId: a.applicationId,
              ordinal: a.ordinal,
              step: a.step,
              outcome: a.outcome,
              errorCode: a.errorCode,
              errorMessage: a.errorMessage,
              evidenceRef: a.evidenceRef,
              startedAt: a.startedAt,
              finishedAt: a.finishedAt,
            })),
            receipt: r.receipt
              ? {
                  id: r.receipt.id,
                  applicationId: r.receipt.applicationId,
                  attemptId: r.receipt.attemptId,
                  endpointFingerprint: r.receipt.endpointFingerprint,
                  responseStatus: r.receipt.responseStatus,
                  confirmationFingerprint: r.receipt.confirmationFingerprint,
                  artifactChecksum: r.receipt.artifactChecksum,
                  externalRequestId: r.receipt.externalRequestId,
                  submittedAt: r.receipt.submittedAt,
                }
              : null,
          }),
      ),
      total,
    };
  }

  async findStuckProcessing(timeoutMinutes = 10): Promise<JobApplication[]> {
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    const records = await this.prisma.jobApplication.findMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: cutoff },
      },
      include: { attempts: true, receipt: true },
    });

    return records.map(
      (r) =>
        new JobApplication({
          id: r.id,
          userId: r.userId,
          jobId: r.jobId,
          jobUrl: r.jobUrl,
          status: r.status as ApplicationStatus,
          processingStep: r.processingStep as ProcessingStep | null,
          resumeMode: r.resumeMode as ResumeMode,
          resumeArtifactId: r.resumeArtifactId,
          answers: r.answers as Record<string, unknown> | null,
          formSchemaSnapshot: r.formSchemaSnapshot,
          candidateProfileSnapshot: r.candidateProfileSnapshot,
          attemptsCount: r.attemptsCount,
          matchScore: r.matchScore,
          autoApplied: r.autoApplied,
          errorCode: r.errorCode,
          errorMessage: r.errorMessage,
          submittedAt: r.submittedAt,
          version: r.version,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }),
    );
  }

  async findQueuedWithoutJob(): Promise<JobApplication[]> {
    const records = await this.prisma.jobApplication.findMany({
      where: {
        status: 'QUEUED',
      },
      include: { attempts: true, receipt: true },
    });

    return records.map(
      (r) =>
        new JobApplication({
          id: r.id,
          userId: r.userId,
          jobId: r.jobId,
          jobUrl: r.jobUrl,
          status: r.status as ApplicationStatus,
          processingStep: r.processingStep as ProcessingStep | null,
          resumeMode: r.resumeMode as ResumeMode,
          resumeArtifactId: r.resumeArtifactId,
          answers: r.answers as Record<string, unknown> | null,
          formSchemaSnapshot: r.formSchemaSnapshot,
          candidateProfileSnapshot: r.candidateProfileSnapshot,
          attemptsCount: r.attemptsCount,
          matchScore: r.matchScore,
          autoApplied: r.autoApplied,
          errorCode: r.errorCode,
          errorMessage: r.errorMessage,
          submittedAt: r.submittedAt,
          version: r.version,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }),
    );
  }

  async save(application: JobApplication): Promise<JobApplication> {
    const record = await this.prisma.jobApplication.upsert({
      where: { id: application.id },
      create: {
        id: application.id,
        userId: application.userId,
        jobId: application.jobId,
        jobUrl: application.jobUrl,
        status: application.status,
        processingStep: application.processingStep,
        resumeMode: application.resumeMode,
        resumeArtifactId: application.resumeArtifactId,
        answers: application.answers ? (application.answers as Prisma.InputJsonValue) : Prisma.JsonNull,
        formSchemaSnapshot: application.formSchemaSnapshot ? (application.formSchemaSnapshot as Prisma.InputJsonValue) : Prisma.JsonNull,
        candidateProfileSnapshot: application.candidateProfileSnapshot ? (application.candidateProfileSnapshot as Prisma.InputJsonValue) : Prisma.JsonNull,
        attemptsCount: application.attemptsCount,
        matchScore: application.matchScore,
        autoApplied: application.autoApplied,
        errorCode: application.errorCode,
        errorMessage: application.errorMessage,
        submittedAt: application.submittedAt,
        version: application.version,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
      },
      update: {
        status: application.status,
        processingStep: application.processingStep,
        resumeArtifactId: application.resumeArtifactId,
        attemptsCount: application.attemptsCount,
        matchScore: application.matchScore,
        errorCode: application.errorCode,
        errorMessage: application.errorMessage,
        submittedAt: application.submittedAt,
        version: application.version,
        updatedAt: application.updatedAt,
      },
      include: { attempts: true, receipt: true },
    });

    return new JobApplication({
      id: record.id,
      userId: record.userId,
      jobId: record.jobId,
      jobUrl: record.jobUrl,
      status: record.status as ApplicationStatus,
      processingStep: record.processingStep as ProcessingStep | null,
      resumeMode: record.resumeMode as ResumeMode,
      resumeArtifactId: record.resumeArtifactId,
      answers: record.answers as Record<string, unknown> | null,
      formSchemaSnapshot: record.formSchemaSnapshot,
      candidateProfileSnapshot: record.candidateProfileSnapshot,
      attemptsCount: record.attemptsCount,
      matchScore: record.matchScore,
      autoApplied: record.autoApplied,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      submittedAt: record.submittedAt,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      attempts: application.attempts,
      receipt: application.receipt,
    });
  }

  async addAttempt(attempt: ApplicationAttemptProps): Promise<void> {
    await this.prisma.applicationAttempt.create({
      data: {
        id: attempt.id,
        applicationId: attempt.applicationId,
        ordinal: attempt.ordinal,
        step: attempt.step,
        outcome: attempt.outcome,
        errorCode: attempt.errorCode,
        errorMessage: attempt.errorMessage,
        evidenceRef: attempt.evidenceRef,
        startedAt: attempt.startedAt,
        finishedAt: attempt.finishedAt,
      },
    });
  }

  async saveReceipt(receipt: SubmissionReceiptProps): Promise<void> {
    await this.prisma.submissionReceipt.create({
      data: {
        id: receipt.id,
        applicationId: receipt.applicationId,
        attemptId: receipt.attemptId,
        endpointFingerprint: receipt.endpointFingerprint,
        responseStatus: receipt.responseStatus,
        confirmationFingerprint: receipt.confirmationFingerprint,
        artifactChecksum: receipt.artifactChecksum,
        externalRequestId: receipt.externalRequestId,
        submittedAt: receipt.submittedAt,
      },
    });
  }
}
