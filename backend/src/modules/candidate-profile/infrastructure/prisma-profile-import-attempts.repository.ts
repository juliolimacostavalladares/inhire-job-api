import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ProfileImportAttemptsRepository } from '../application/ports/profile-import-attempts.repository';
import { ProfileImportAttempt, ImportStatus } from '../domain/profile-import-attempt.entity';

@Injectable()
export class PrismaProfileImportAttemptsRepository implements ProfileImportAttemptsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ProfileImportAttempt | null> {
    const record = await this.prisma.profileImportAttempt.findUnique({ where: { id } });
    if (!record) return null;
    return new ProfileImportAttempt({
      id: record.id,
      userId: record.userId,
      status: record.status as ImportStatus,
      rawArtifactId: record.rawArtifactId,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      createdAt: record.createdAt,
      finishedAt: record.finishedAt,
    });
  }

  async save(attempt: ProfileImportAttempt): Promise<ProfileImportAttempt> {
    const record = await this.prisma.profileImportAttempt.upsert({
      where: { id: attempt.id },
      create: {
        id: attempt.id,
        userId: attempt.userId,
        status: attempt.status,
        rawArtifactId: attempt.rawArtifactId,
        errorCode: attempt.errorCode,
        errorMessage: attempt.errorMessage,
        createdAt: attempt.createdAt,
        finishedAt: attempt.finishedAt,
      },
      update: {
        status: attempt.status,
        rawArtifactId: attempt.rawArtifactId,
        errorCode: attempt.errorCode,
        errorMessage: attempt.errorMessage,
        finishedAt: attempt.finishedAt,
      },
    });

    return new ProfileImportAttempt({
      id: record.id,
      userId: record.userId,
      status: record.status as ImportStatus,
      rawArtifactId: record.rawArtifactId,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      createdAt: record.createdAt,
      finishedAt: record.finishedAt,
    });
  }
}
