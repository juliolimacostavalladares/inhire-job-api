import { FormFieldSchema } from '../../../catalog/domain/job.entity';
import { SubmissionOutcomeResult } from '../../domain/submission-outcome.vo';

export interface ApplicationPackage {
  applicationId: string;
  jobUrl: string; // Canonical Job URL byte-for-byte
  candidateData: Record<string, unknown>;
  answers: Record<string, unknown>;
  formSchema: FormFieldSchema[];
  resume: {
    artifactId: string;
    fileName: string;
    mimeType: string;
    checksum: string;
    buffer: Buffer;
  };
}

export interface OfficialApplicationSubmitter {
  submit(pkg: ApplicationPackage): Promise<SubmissionOutcomeResult>;
}

export const OFFICIAL_APPLICATION_SUBMITTER = Symbol('OfficialApplicationSubmitter');
