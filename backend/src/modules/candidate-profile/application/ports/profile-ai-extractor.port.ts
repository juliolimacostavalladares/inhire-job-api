import { ExperienceInfo, EducationInfo, LocationInfo } from '../../domain/candidate-profile.entity';

export interface ExtractedProfileData {
  fullName?: string | null;
  headline?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: LocationInfo | null;
  skills: string[];
  searchTerms?: string[];
  experiences?: ExperienceInfo[] | null;
  education?: EducationInfo[] | null;
}

export interface ProfileAiExtractor {
  extractFromResumeText(resumeText: string): Promise<ExtractedProfileData>;
}

export const PROFILE_AI_EXTRACTOR = Symbol('ProfileAiExtractor');
