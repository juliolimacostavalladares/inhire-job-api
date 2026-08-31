import { Injectable, Inject } from '@nestjs/common';
import { PROFILE_IMPORT_ATTEMPTS_REPOSITORY, ProfileImportAttemptsRepository } from '../ports/profile-import-attempts.repository';
import { ProfileImportAttempt } from '../../domain/profile-import-attempt.entity';
import { ARTIFACT_STORAGE_PORT, ArtifactStorage } from '@shared/infrastructure/storage/artifact-storage.port';
import { BullMQService } from '@shared/infrastructure/bullmq/bullmq.service';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { AppError } from '@shared/domain/errors/app-error';

export interface ImportProfileResult {
  importId: string;
  status: string;
  location: string;
}

@Injectable()
export class ImportProfileUseCase {
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MiB

  constructor(
    @Inject(PROFILE_IMPORT_ATTEMPTS_REPOSITORY) private readonly attemptsRepo: ProfileImportAttemptsRepository,
    @Inject(ARTIFACT_STORAGE_PORT) private readonly storage: ArtifactStorage,
    private readonly bullmqService: BullMQService,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
  ) {}

  async execute(userId: string, fileBuffer: Buffer, mimeType: string, correlationId?: string): Promise<ImportProfileResult> {
    // CAND-AC-03: PDF inválido não chega ao provider de IA
    if (fileBuffer.length > ImportProfileUseCase.MAX_FILE_SIZE) {
      throw AppError.validationFailed('File exceeds maximum size of 10MB');
    }

    // Check magic bytes for PDF (%PDF-)
    const isPdf = fileBuffer.length >= 4 && fileBuffer.subarray(0, 4).toString() === '%PDF';
    if (!isPdf || mimeType !== 'application/pdf') {
      throw AppError.validationFailed('Uploaded file must be a valid PDF');
    }

    const importId = this.idGenerator.generate();
    const storageKey = `profiles/${userId}/${importId}.pdf`;

    const stored = await this.storage.upload(storageKey, fileBuffer, mimeType);

    const attempt = ProfileImportAttempt.create({
      id: importId,
      userId,
      rawArtifactId: stored.key,
      now: this.clock.now(),
    });

    await this.attemptsRepo.save(attempt);

    // Enqueue profile-analysis job
    await this.bullmqService.addJob(
      'profile-analysis',
      'analyze-profile',
      {
        importId,
        userId,
        correlationId,
      },
      `profile:${importId}`,
    );

    return {
      importId,
      status: 'PENDING',
      location: `/v1/me/profile/imports/${importId}`,
    };
  }
}
