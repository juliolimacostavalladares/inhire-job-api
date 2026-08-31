export type ImportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface ProfileImportAttemptProps {
  id: string;
  userId: string;
  status: ImportStatus;
  rawArtifactId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
  finishedAt?: Date | null;
}

export class ProfileImportAttempt {
  constructor(private readonly props: ProfileImportAttemptProps) {}

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get status(): ImportStatus {
    return this.props.status;
  }

  get rawArtifactId(): string | null | undefined {
    return this.props.rawArtifactId;
  }

  get errorCode(): string | null | undefined {
    return this.props.errorCode;
  }

  get errorMessage(): string | null | undefined {
    return this.props.errorMessage;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get finishedAt(): Date | null | undefined {
    return this.props.finishedAt;
  }

  markCompleted(now: Date = new Date()): void {
    this.props.status = 'COMPLETED';
    this.props.finishedAt = now;
  }

  markFailed(errorCode: string, errorMessage: string, now: Date = new Date()): void {
    this.props.status = 'FAILED';
    this.props.errorCode = errorCode;
    this.props.errorMessage = errorMessage;
    this.props.finishedAt = now;
  }

  static create(props: { id: string; userId: string; rawArtifactId?: string; now?: Date }): ProfileImportAttempt {
    return new ProfileImportAttempt({
      id: props.id,
      userId: props.userId,
      status: 'PENDING',
      rawArtifactId: props.rawArtifactId || null,
      createdAt: props.now ?? new Date(),
    });
  }
}
