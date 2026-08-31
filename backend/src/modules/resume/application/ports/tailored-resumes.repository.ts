import { TailoredResume, ResumeGenerationAttemptProps } from '../../domain/tailored-resume.entity';

export interface TailoredResumesRepository {
  findById(id: string): Promise<TailoredResume | null>;
  findByVersions(
    userId: string,
    jobId: string,
    profileVersion: number,
    jobVersion: number,
    templateVersion: number,
  ): Promise<TailoredResume | null>;
  findLatestByJobAndUser(userId: string, jobId: string): Promise<TailoredResume | null>;
  save(resume: TailoredResume): Promise<TailoredResume>;
  addAttempt(attempt: ResumeGenerationAttemptProps): Promise<void>;
}

export const TAILORED_RESUMES_REPOSITORY = Symbol('TailoredResumesRepository');
