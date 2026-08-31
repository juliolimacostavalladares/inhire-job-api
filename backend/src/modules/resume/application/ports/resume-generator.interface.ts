export interface ResumeArtifactDto {
  artifactId: string;
  key: string;
  mimeType: string;
  fileSize: number;
  sha256Checksum: string;
  pdfBuffer: Buffer;
}

export interface ResumeGenerator {
  ensureReady(input: {
    userId: string;
    jobId: string;
    applicationId?: string;
  }): Promise<ResumeArtifactDto>;
}

export const RESUME_GENERATOR = Symbol('ResumeGenerator');
