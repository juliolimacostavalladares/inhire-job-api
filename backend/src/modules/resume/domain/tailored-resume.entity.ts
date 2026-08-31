export type ResumeStatus = 'REQUESTED' | 'GENERATING' | 'RENDERING' | 'READY' | 'FAILED';

export interface ResumeGenerationAttemptProps {
  id: string;
  tailoredResumeId: string;
  ordinal: number;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  errorCode?: string | null;
  startedAt: Date;
  finishedAt?: Date | null;
}

export interface TailoredResumeProps {
  id: string;
  userId: string;
  jobId: string;
  profileVersion: number;
  jobVersion: number;
  templateVersion: number;
  status: ResumeStatus;
  matchScore?: number | null;
  matchSummary?: string | null;
  resumeArtifactId?: string | null;
  errorCode?: string | null;
  createdAt: Date;
  updatedAt: Date;
  attempts?: ResumeGenerationAttemptProps[];
}

export class TailoredResume {
  constructor(private readonly props: TailoredResumeProps) {}

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get jobId(): string {
    return this.props.jobId;
  }

  get profileVersion(): number {
    return this.props.profileVersion;
  }

  get jobVersion(): number {
    return this.props.jobVersion;
  }

  get templateVersion(): number {
    return this.props.templateVersion;
  }

  get status(): ResumeStatus {
    return this.props.status;
  }

  get matchScore(): number | null | undefined {
    return this.props.matchScore;
  }

  get matchSummary(): string | null | undefined {
    return this.props.matchSummary;
  }

  get resumeArtifactId(): string | null | undefined {
    return this.props.resumeArtifactId;
  }

  get errorCode(): string | null | undefined {
    return this.props.errorCode;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get attempts(): ResumeGenerationAttemptProps[] {
    return this.props.attempts ?? [];
  }

  markGenerating(now: Date = new Date()): void {
    this.props.status = 'GENERATING';
    this.props.updatedAt = now;
  }

  markRendering(matchScore: number, matchSummary: string, now: Date = new Date()): void {
    this.props.status = 'RENDERING';
    this.props.matchScore = matchScore;
    this.props.matchSummary = matchSummary;
    this.props.updatedAt = now;
  }

  markReady(artifactId: string, now: Date = new Date()): void {
    this.props.status = 'READY';
    this.props.resumeArtifactId = artifactId;
    this.props.errorCode = null;
    this.props.updatedAt = now;
  }

  markFailed(errorCode: string, now: Date = new Date()): void {
    this.props.status = 'FAILED';
    this.props.errorCode = errorCode;
    this.props.updatedAt = now;
  }

  static create(props: {
    id: string;
    userId: string;
    jobId: string;
    profileVersion: number;
    jobVersion: number;
    templateVersion?: number;
    now?: Date;
  }): TailoredResume {
    const now = props.now ?? new Date();
    return new TailoredResume({
      id: props.id,
      userId: props.userId,
      jobId: props.jobId,
      profileVersion: props.profileVersion,
      jobVersion: props.jobVersion,
      templateVersion: props.templateVersion ?? 1,
      status: 'REQUESTED',
      createdAt: now,
      updatedAt: now,
      attempts: [],
    });
  }
}
