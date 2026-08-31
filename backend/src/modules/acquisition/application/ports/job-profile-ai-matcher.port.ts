export interface CandidateProfileForAi {
  headline?: string | null;
  skills: string[];
  experiences?: Array<{ role?: string; company?: string; description?: string }> | null;
  targetRoles?: string[];
}

export interface JobDataForAi {
  title: string;
  description: string;
  location?: string;
}

export interface AiMatchEvaluationResult {
  isMatch: boolean;
  matchScore: number; // 0 - 100
  reason: string;
}

export interface JobProfileAiMatcher {
  evaluateMatch(profile: CandidateProfileForAi, job: JobDataForAi): Promise<AiMatchEvaluationResult>;
}

export const JOB_PROFILE_AI_MATCHER = Symbol('JobProfileAiMatcher');
