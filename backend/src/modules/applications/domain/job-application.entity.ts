import { AppError } from '@shared/domain/errors/app-error';

export type ApplicationStatus = 'QUEUED' | 'PROCESSING' | 'SUBMITTED' | 'REQUIRES_MANUAL_ACTION' | 'FAILED';
export type ProcessingStep = 'PREPARING_DATA' | 'GENERATING_RESUME' | 'SUBMITTING';
export type ResumeMode = 'AI_TAILORED' | 'EXISTING';

export interface ApplicationAttemptProps {
  id: string;
  applicationId: string;
  ordinal: number;
  step: string;
  outcome: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  evidenceRef?: string | null;
  startedAt: Date;
  finishedAt?: Date | null;
}

export interface SubmissionReceiptProps {
  id: string;
  applicationId: string;
  attemptId: string;
  endpointFingerprint: string;
  responseStatus: number;
  confirmationFingerprint: string;
  artifactChecksum: string;
  externalRequestId?: string | null;
  submittedAt: Date;
}

export interface JobApplicationProps {
  id: string;
  userId: string;
  jobId: string;
  jobUrl: string; // Exact immutable snapshot of Job.url
  status: ApplicationStatus;
  processingStep?: ProcessingStep | null;
  resumeMode: ResumeMode;
  resumeArtifactId?: string | null;
  answers?: Record<string, unknown> | null;
  formSchemaSnapshot?: unknown | null;
  candidateProfileSnapshot?: unknown | null;
  attemptsCount: number;
  matchScore?: number | null;
  autoApplied: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
  submittedAt?: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  attempts?: ApplicationAttemptProps[];
  receipt?: SubmissionReceiptProps | null;
}

export class JobApplication {
  constructor(private readonly props: JobApplicationProps) {}

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get jobId(): string {
    return this.props.jobId;
  }

  get jobUrl(): string {
    return this.props.jobUrl;
  }

  get status(): ApplicationStatus {
    return this.props.status;
  }

  get processingStep(): ProcessingStep | null | undefined {
    return this.props.processingStep;
  }

  get resumeMode(): ResumeMode {
    return this.props.resumeMode;
  }

  get resumeArtifactId(): string | null | undefined {
    return this.props.resumeArtifactId;
  }

  get answers(): Record<string, unknown> | null | undefined {
    return this.props.answers;
  }

  get formSchemaSnapshot(): unknown {
    return this.props.formSchemaSnapshot;
  }

  get candidateProfileSnapshot(): unknown {
    return this.props.candidateProfileSnapshot;
  }

  get attemptsCount(): number {
    return this.props.attemptsCount;
  }

  get matchScore(): number | null | undefined {
    return this.props.matchScore;
  }

  get autoApplied(): boolean {
    return this.props.autoApplied;
  }

  get errorCode(): string | null | undefined {
    return this.props.errorCode;
  }

  get errorMessage(): string | null | undefined {
    return this.props.errorMessage;
  }

  get submittedAt(): Date | null | undefined {
    return this.props.submittedAt;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get attempts(): ApplicationAttemptProps[] {
    return this.props.attempts ?? [];
  }

  get receipt(): SubmissionReceiptProps | null | undefined {
    return this.props.receipt;
  }

  isTerminal(): boolean {
    return (
      this.props.status === 'SUBMITTED' ||
      this.props.status === 'REQUIRES_MANUAL_ACTION' ||
      this.props.status === 'FAILED'
    );
  }

  startProcessing(step: ProcessingStep = 'PREPARING_DATA', now: Date = new Date()): void {
    if (this.props.status === 'SUBMITTED') {
      throw AppError.invalidStateTransition('Cannot process an already submitted application');
    }
    this.props.status = 'PROCESSING';
    this.props.processingStep = step;
    this.props.attemptsCount += 1;
    this.props.version += 1;
    this.props.updatedAt = now;
  }

  updateStep(step: ProcessingStep, now: Date = new Date()): void {
    this.props.processingStep = step;
    this.props.updatedAt = now;
  }

  setResumeArtifact(artifactId: string, now: Date = new Date()): void {
    this.props.resumeArtifactId = artifactId;
    this.props.updatedAt = now;
  }

  markSubmitted(receipt: SubmissionReceiptProps, now: Date = new Date()): void {
    this.props.status = 'SUBMITTED';
    this.props.processingStep = null;
    this.props.submittedAt = receipt.submittedAt || now;
    this.props.receipt = receipt;
    this.props.errorCode = null;
    this.props.errorMessage = null;
    this.props.version += 1;
    this.props.updatedAt = now;
  }

  markRequiresManualAction(errorCode: string, errorMessage: string, now: Date = new Date()): void {
    this.props.status = 'REQUIRES_MANUAL_ACTION';
    this.props.processingStep = null;
    this.props.errorCode = errorCode;
    this.props.errorMessage = errorMessage;
    this.props.version += 1;
    this.props.updatedAt = now;
  }

  markFailed(errorCode: string, errorMessage: string, now: Date = new Date()): void {
    this.props.status = 'FAILED';
    this.props.processingStep = null;
    this.props.errorCode = errorCode;
    this.props.errorMessage = errorMessage;
    this.props.version += 1;
    this.props.updatedAt = now;
  }

  static create(props: {
    id: string;
    userId: string;
    jobId: string;
    jobUrl: string;
    resumeMode: ResumeMode;
    resumeArtifactId?: string;
    answers?: Record<string, unknown>;
    formSchemaSnapshot?: unknown;
    candidateProfileSnapshot?: unknown;
    matchScore?: number;
    autoApplied?: boolean;
    now?: Date;
  }): JobApplication {
    const now = props.now ?? new Date();
    return new JobApplication({
      id: props.id,
      userId: props.userId,
      jobId: props.jobId,
      jobUrl: props.jobUrl, // Exact copy
      status: 'QUEUED',
      processingStep: null,
      resumeMode: props.resumeMode,
      resumeArtifactId: props.resumeArtifactId || null,
      answers: props.answers || null,
      formSchemaSnapshot: props.formSchemaSnapshot || null,
      candidateProfileSnapshot: props.candidateProfileSnapshot || null,
      attemptsCount: 0,
      matchScore: props.matchScore ?? null,
      autoApplied: props.autoApplied ?? false,
      version: 1,
      createdAt: now,
      updatedAt: now,
      attempts: [],
      receipt: null,
    });
  }
}
