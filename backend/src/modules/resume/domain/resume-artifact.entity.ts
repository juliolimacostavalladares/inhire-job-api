export interface ResumeArtifactProps {
  id: string;
  userId: string;
  storageKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256Checksum: string;
  createdAt: Date;
}

export class ResumeArtifact {
  constructor(private readonly props: ResumeArtifactProps) {}

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get storageKey(): string {
    return this.props.storageKey;
  }

  get fileName(): string {
    return this.props.fileName;
  }

  get mimeType(): string {
    return this.props.mimeType;
  }

  get fileSize(): number {
    return this.props.fileSize;
  }

  get sha256Checksum(): string {
    return this.props.sha256Checksum;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  static create(props: {
    id: string;
    userId: string;
    storageKey: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    sha256Checksum: string;
    now?: Date;
  }): ResumeArtifact {
    return new ResumeArtifact({
      id: props.id,
      userId: props.userId,
      storageKey: props.storageKey,
      fileName: props.fileName,
      mimeType: props.mimeType,
      fileSize: props.fileSize,
      sha256Checksum: props.sha256Checksum,
      createdAt: props.now ?? new Date(),
    });
  }
}
