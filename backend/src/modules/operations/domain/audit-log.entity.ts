export interface AuditLogProps {
  id: string;
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  correlationId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: Date;
}

export class AuditLog {
  constructor(private readonly props: AuditLogProps) {}

  get id(): string {
    return this.props.id;
  }

  get actorId(): string | null | undefined {
    return this.props.actorId;
  }

  get actorRole(): string | null | undefined {
    return this.props.actorRole;
  }

  get action(): string {
    return this.props.action;
  }

  get targetType(): string {
    return this.props.targetType;
  }

  get targetId(): string | null | undefined {
    return this.props.targetId;
  }

  get correlationId(): string | null | undefined {
    return this.props.correlationId;
  }

  get details(): Record<string, unknown> | null | undefined {
    return this.props.details;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  static create(props: {
    id: string;
    action: string;
    targetType: string;
    actorId?: string;
    actorRole?: string;
    targetId?: string;
    correlationId?: string;
    details?: Record<string, unknown>;
    now?: Date;
  }): AuditLog {
    return new AuditLog({
      id: props.id,
      action: props.action,
      targetType: props.targetType,
      actorId: props.actorId || null,
      actorRole: props.actorRole || null,
      targetId: props.targetId || null,
      correlationId: props.correlationId || null,
      details: props.details || null,
      createdAt: props.now ?? new Date(),
    });
  }
}
