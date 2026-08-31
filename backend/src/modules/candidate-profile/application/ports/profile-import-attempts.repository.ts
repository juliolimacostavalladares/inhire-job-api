import { ProfileImportAttempt } from '../../domain/profile-import-attempt.entity';

export interface ProfileImportAttemptsRepository {
  findById(id: string): Promise<ProfileImportAttempt | null>;
  save(attempt: ProfileImportAttempt): Promise<ProfileImportAttempt>;
}

export const PROFILE_IMPORT_ATTEMPTS_REPOSITORY = Symbol('ProfileImportAttemptsRepository');
