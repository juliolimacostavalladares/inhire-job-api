import { CandidateProfile } from '../../domain/candidate-profile.entity';

export interface CandidateProfileRepository {
  findByUserId(userId: string): Promise<CandidateProfile | null>;
  save(profile: CandidateProfile): Promise<CandidateProfile>;
}

export const CANDIDATE_PROFILE_REPOSITORY = Symbol('CandidateProfileRepository');
