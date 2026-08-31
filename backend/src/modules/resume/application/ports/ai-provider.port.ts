import { CandidateProfile } from '../../../candidate-profile/domain/candidate-profile.entity';
import { JobSnapshot } from '../../../catalog/domain/job.entity';

export interface TailoredContentResult {
  matchScore: number; // 0 - 100
  matchSummary: string;
  tailoredHeadline: string;
  tailoredSummary: string;
  highlightedSkills: string[];
}

export interface AiProvider {
  generateTailoredContent(profile: CandidateProfile, job: JobSnapshot): Promise<TailoredContentResult>;
}

export const AI_PROVIDER = Symbol('AiProvider');
