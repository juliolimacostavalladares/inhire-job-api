import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { TailoredResumesRepository } from '../application/ports/tailored-resumes.repository';
import { TailoredResume, ResumeStatus, ResumeGenerationAttemptProps } from '../domain/tailored-resume.entity';

@Injectable()
export class PrismaTailoredResumesRepository implements TailoredResumesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TailoredResume | null> {
    const record = await this.prisma.tailoredResume.findUnique({
      where: { id },
      include: { attempts: true },
    });
    if (!record) return null;

    return new TailoredResume({
      id: record.id,
      userId: record.userId,
      jobId: record.jobId,
      profileVersion: record.profileVersion,
      jobVersion: record.jobVersion,
      templateVersion: record.templateVersion,
      status: record.status as ResumeStatus,
      matchScore: record.matchScore,
      matchSummary: record.matchSummary,
      resumeArtifactId: record.resumeArtifactId,
      errorCode: record.errorCode,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      attempts: record.attempts.map((a) => ({
        id: a.id,
        tailoredResumeId: a.tailoredResumeId,
        ordinal: a.ordinal,
        status: a.status as 'RUNNING' | 'SUCCEEDED' | 'FAILED',
        errorCode: a.errorCode,
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
      })),
    });
  }

  async findByVersions(
    userId: string,
    jobId: string,
    profileVersion: number,
    jobVersion: number,
    templateVersion: number,
  ): Promise<TailoredResume | null> {
    const record = await this.prisma.tailoredResume.findUnique({
      where: {
        userId_jobId_profileVersion_jobVersion_templateVersion: {
          userId,
          jobId,
          profileVersion,
          jobVersion,
          templateVersion,
        },
      },
      include: { attempts: true },
    });
    if (!record) return null;

    return new TailoredResume({
      id: record.id,
      userId: record.userId,
      jobId: record.jobId,
      profileVersion: record.profileVersion,
      jobVersion: record.jobVersion,
      templateVersion: record.templateVersion,
      status: record.status as ResumeStatus,
      matchScore: record.matchScore,
      matchSummary: record.matchSummary,
      resumeArtifactId: record.resumeArtifactId,
      errorCode: record.errorCode,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      attempts: record.attempts.map((a) => ({
        id: a.id,
        tailoredResumeId: a.tailoredResumeId,
        ordinal: a.ordinal,
        status: a.status as 'RUNNING' | 'SUCCEEDED' | 'FAILED',
        errorCode: a.errorCode,
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
      })),
    });
  }

  async findLatestByJobAndUser(userId: string, jobId: string): Promise<TailoredResume | null> {
    const record = await this.prisma.tailoredResume.findFirst({
      where: { userId, jobId },
      orderBy: { createdAt: 'desc' },
      include: { attempts: true },
    });
    if (!record) return null;

    return new TailoredResume({
      id: record.id,
      userId: record.userId,
      jobId: record.jobId,
      profileVersion: record.profileVersion,
      jobVersion: record.jobVersion,
      templateVersion: record.templateVersion,
      status: record.status as ResumeStatus,
      matchScore: record.matchScore,
      matchSummary: record.matchSummary,
      resumeArtifactId: record.resumeArtifactId,
      errorCode: record.errorCode,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      attempts: record.attempts.map((a) => ({
        id: a.id,
        tailoredResumeId: a.tailoredResumeId,
        ordinal: a.ordinal,
        status: a.status as 'RUNNING' | 'SUCCEEDED' | 'FAILED',
        errorCode: a.errorCode,
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
      })),
    });
  }

  async save(resume: TailoredResume): Promise<TailoredResume> {
    const record = await this.prisma.tailoredResume.upsert({
      where: { id: resume.id },
      create: {
        id: resume.id,
        userId: resume.userId,
        jobId: resume.jobId,
        profileVersion: resume.profileVersion,
        jobVersion: resume.jobVersion,
        templateVersion: resume.templateVersion,
        status: resume.status,
        matchScore: resume.matchScore,
        matchSummary: resume.matchSummary,
        resumeArtifactId: resume.resumeArtifactId,
        errorCode: resume.errorCode,
        createdAt: resume.createdAt,
        updatedAt: resume.updatedAt,
      },
      update: {
        status: resume.status,
        matchScore: resume.matchScore,
        matchSummary: resume.matchSummary,
        resumeArtifactId: resume.resumeArtifactId,
        errorCode: resume.errorCode,
        updatedAt: resume.updatedAt,
      },
    });

    return new TailoredResume({
      id: record.id,
      userId: record.userId,
      jobId: record.jobId,
      profileVersion: record.profileVersion,
      jobVersion: record.jobVersion,
      templateVersion: record.templateVersion,
      status: record.status as ResumeStatus,
      matchScore: record.matchScore,
      matchSummary: record.matchSummary,
      resumeArtifactId: record.resumeArtifactId,
      errorCode: record.errorCode,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      attempts: resume.attempts,
    });
  }

  async addAttempt(attempt: ResumeGenerationAttemptProps): Promise<void> {
    await this.prisma.resumeGenerationAttempt.create({
      data: {
        id: attempt.id,
        tailoredResumeId: attempt.tailoredResumeId,
        ordinal: attempt.ordinal,
        status: attempt.status,
        errorCode: attempt.errorCode,
        startedAt: attempt.startedAt,
        finishedAt: attempt.finishedAt,
      },
    });
  }
}
