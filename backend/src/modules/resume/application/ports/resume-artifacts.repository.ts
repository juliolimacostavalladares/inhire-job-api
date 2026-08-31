import { ResumeArtifact } from '../../domain/resume-artifact.entity';

export interface ResumeArtifactsRepository {
  findById(id: string): Promise<ResumeArtifact | null>;
  save(artifact: ResumeArtifact): Promise<ResumeArtifact>;
}

export const RESUME_ARTIFACTS_REPOSITORY = Symbol('ResumeArtifactsRepository');
