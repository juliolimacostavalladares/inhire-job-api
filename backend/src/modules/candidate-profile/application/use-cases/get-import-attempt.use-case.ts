import { Injectable, Inject } from '@nestjs/common';
import { PROFILE_IMPORT_ATTEMPTS_REPOSITORY, ProfileImportAttemptsRepository } from '../ports/profile-import-attempts.repository';
import { ProfileImportAttempt } from '../../domain/profile-import-attempt.entity';
import { AppError } from '@shared/domain/errors/app-error';

@Injectable()
export class GetImportAttemptUseCase {
  constructor(
    @Inject(PROFILE_IMPORT_ATTEMPTS_REPOSITORY) private readonly attemptsRepo: ProfileImportAttemptsRepository,
  ) {}

  async execute(userId: string, importId: string): Promise<ProfileImportAttempt> {
    const attempt = await this.attemptsRepo.findById(importId);
    if (!attempt || attempt.userId !== userId) {
      throw AppError.notFound('Import attempt not found');
    }
    return attempt;
  }
}
