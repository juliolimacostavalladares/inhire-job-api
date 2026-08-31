export interface RefreshSessionProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
}

export class RefreshSession {
  constructor(private readonly props: RefreshSessionProps) {}

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get revokedAt(): Date | null | undefined {
    return this.props.revokedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  isActive(now: Date = new Date()): boolean {
    return !this.props.revokedAt && this.props.expiresAt.getTime() > now.getTime();
  }

  revoke(now: Date = new Date()): void {
    this.props.revokedAt = now;
  }

  static create(props: { id: string; userId: string; tokenHash: string; expiresAt: Date; now?: Date }): RefreshSession {
    return new RefreshSession({
      id: props.id,
      userId: props.userId,
      tokenHash: props.tokenHash,
      expiresAt: props.expiresAt,
      revokedAt: null,
      createdAt: props.now ?? new Date(),
    });
  }
}
