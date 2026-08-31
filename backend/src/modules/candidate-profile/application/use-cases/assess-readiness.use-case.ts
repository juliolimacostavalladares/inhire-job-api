import { Injectable, Inject } from '@nestjs/common';
import { CANDIDATE_PROFILE_REPOSITORY, CandidateProfileRepository } from '../ports/candidate-profile.repository';
import { ReadinessResult } from '../../domain/candidate-profile.entity';
import { AppError } from '@shared/domain/errors/app-error';

@Injectable()
export class AssessReadinessUseCase {
  constructor(
    @Inject(CANDIDATE_PROFILE_REPOSITORY) private readonly profileRepo: CandidateProfileRepository,
  ) {}

  async execute(userId: string, purpose: 'SUBMISSION' | 'TAILORED_RESUME'): Promise<ReadinessResult> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      return {
        ready: false,
        missingFields: ['profile_not_created'],
        version: 0,
      };
    }
    return profile.assessReadiness(purpose);
  }
}
