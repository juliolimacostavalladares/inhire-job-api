import { JobApplication, ApplicationAttemptProps, SubmissionReceiptProps } from '../../domain/job-application.entity';

export interface JobApplicationsRepository {
  findById(id: string): Promise<JobApplication | null>;
  findByUserAndJob(userId: string, jobId: string): Promise<JobApplication | null>;
  findAll(filter?: { userId?: string; status?: string; page?: number; limit?: number }): Promise<{ items: JobApplication[]; total: number }>;
  findStuckProcessing(timeoutMinutes: number): Promise<JobApplication[]>;
  findQueuedWithoutJob(): Promise<JobApplication[]>;
  save(application: JobApplication): Promise<JobApplication>;
  addAttempt(attempt: ApplicationAttemptProps): Promise<void>;
  saveReceipt(receipt: SubmissionReceiptProps): Promise<void>;
}

export const JOB_APPLICATIONS_REPOSITORY = Symbol('JobApplicationsRepository');
