import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ResumeArtifactsRepository } from '../application/ports/resume-artifacts.repository';
import { ResumeArtifact } from '../domain/resume-artifact.entity';

@Injectable()
export class PrismaResumeArtifactsRepository implements ResumeArtifactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ResumeArtifact | null> {
    const record = await this.prisma.resumeArtifact.findUnique({ where: { id } });
    if (!record) return null;
    return new ResumeArtifact({
      id: record.id,
      userId: record.userId,
      storageKey: record.storageKey,
      fileName: record.fileName,
      mimeType: record.mimeType,
      fileSize: record.fileSize,
      sha256Checksum: record.sha256Checksum,
      createdAt: record.createdAt,
    });
  }

  async save(artifact: ResumeArtifact): Promise<ResumeArtifact> {
    const record = await this.prisma.resumeArtifact.upsert({
      where: { id: artifact.id },
      create: {
        id: artifact.id,
        userId: artifact.userId,
        storageKey: artifact.storageKey,
        fileName: artifact.fileName,
        mimeType: artifact.mimeType,
        fileSize: artifact.fileSize,
        sha256Checksum: artifact.sha256Checksum,
        createdAt: artifact.createdAt,
      },
      update: {
        storageKey: artifact.storageKey,
        fileName: artifact.fileName,
        mimeType: artifact.mimeType,
        fileSize: artifact.fileSize,
        sha256Checksum: artifact.sha256Checksum,
      },
    });

    return new ResumeArtifact({
      id: record.id,
      userId: record.userId,
      storageKey: record.storageKey,
      fileName: record.fileName,
      mimeType: record.mimeType,
      fileSize: record.fileSize,
      sha256Checksum: record.sha256Checksum,
      createdAt: record.createdAt,
    });
  }
}
