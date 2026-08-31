import { CandidateProfile, ReadinessResult } from '../../domain/candidate-profile.entity';

export interface CandidateProfileService {
  getProfile(userId: string): Promise<CandidateProfile>;
  assessReadiness(userId: string, purpose: 'SUBMISSION' | 'TAILORED_RESUME'): Promise<ReadinessResult>;
  prepareApplicationData(userId: string, requiredFields: string[]): Promise<{ data: Record<string, unknown>; profileVersion: number }>;
}

export const CANDIDATE_PROFILE_SERVICE = Symbol('CandidateProfileService');
