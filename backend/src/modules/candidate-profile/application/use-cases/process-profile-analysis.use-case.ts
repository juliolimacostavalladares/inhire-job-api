import { Injectable, Inject } from '@nestjs/common';
import { CANDIDATE_PROFILE_REPOSITORY, CandidateProfileRepository } from '../ports/candidate-profile.repository';
import { PROFILE_IMPORT_ATTEMPTS_REPOSITORY, ProfileImportAttemptsRepository } from '../ports/profile-import-attempts.repository';
import { CandidateProfile } from '../../domain/candidate-profile.entity';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';

@Injectable()
export class ProcessProfileAnalysisUseCase {
  constructor(
    @Inject(CANDIDATE_PROFILE_REPOSITORY) private readonly profileRepo: CandidateProfileRepository,
    @Inject(PROFILE_IMPORT_ATTEMPTS_REPOSITORY) private readonly attemptsRepo: ProfileImportAttemptsRepository,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
    private readonly logger: SanitizedLogger,
  ) {}

  async execute(importId: string, userId: string): Promise<void> {
    const attempt = await this.attemptsRepo.findById(importId);
    if (!attempt || attempt.status === 'COMPLETED') {
      return; // Idempotent
    }

    try {
      let profile = await this.profileRepo.findByUserId(userId);
      if (!profile) {
        profile = CandidateProfile.create({
          id: this.idGenerator.generate(),
          userId,
          now: this.clock.now(),
        });
      }

      // Simulated deterministic extraction from uploaded raw artifact
      profile.update({
        status: 'NEEDS_REVIEW',
        rawResumeArtifactId: attempt.rawArtifactId,
        skills: profile.skills.length > 0 ? profile.skills : ['TypeScript', 'Node.js'],
      });

      await this.profileRepo.save(profile);
      attempt.markCompleted(this.clock.now());
      await this.attemptsRepo.save(attempt);

      this.logger.log({
        operation: 'profile_analysis_completed',
        importId,
        userId,
      }, 'ProcessProfileAnalysisUseCase');
    } catch (err: unknown) {
      const error = err as Error;
      attempt.markFailed('EXTRACTION_FAILED', error.message, this.clock.now());
      await this.attemptsRepo.save(attempt);
      throw err;
    }
  }
}
