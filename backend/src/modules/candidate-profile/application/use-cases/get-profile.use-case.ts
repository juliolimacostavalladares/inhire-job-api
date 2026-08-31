import { Injectable, Inject } from '@nestjs/common';
import { CANDIDATE_PROFILE_REPOSITORY, CandidateProfileRepository } from '../ports/candidate-profile.repository';
import { CandidateProfile } from '../../domain/candidate-profile.entity';
import { AppError } from '@shared/domain/errors/app-error';

@Injectable()
export class GetProfileUseCase {
  constructor(
    @Inject(CANDIDATE_PROFILE_REPOSITORY) private readonly profileRepo: CandidateProfileRepository,
  ) {}

  async execute(userId: string): Promise<CandidateProfile> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      // CAND-FR-05: ausência retorna PROFILE_NOT_STARTED
      throw AppError.profileNotStarted('Candidate profile not created yet');
    }
    return profile;
  }
}
