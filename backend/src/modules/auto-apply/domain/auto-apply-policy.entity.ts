export interface AutoApplyPolicyProps {
  id: string;
  userId: string;
  enabled: boolean;
  minScore: number;
  dailyLimit: number;
  timezone: string;
  targetRoles: string[];
  targetLocations: string[];
  version: number;
  updatedAt: Date;
}

export class AutoApplyPolicy {
  constructor(private readonly props: AutoApplyPolicyProps) {}

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get enabled(): boolean {
    return this.props.enabled;
  }

  get minScore(): number {
    return this.props.minScore;
  }

  get dailyLimit(): number {
    return this.props.dailyLimit;
  }

  get timezone(): string {
    return this.props.timezone;
  }

  get targetRoles(): string[] {
    return this.props.targetRoles;
  }

  get targetLocations(): string[] {
    return this.props.targetLocations;
  }

  get version(): number {
    return this.props.version;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(data: {
    enabled?: boolean;
    minScore?: number;
    dailyLimit?: number;
    timezone?: string;
    targetRoles?: string[];
    targetLocations?: string[];
    now?: Date;
  }): void {
    if (data.enabled !== undefined) this.props.enabled = data.enabled;
    if (data.minScore !== undefined) this.props.minScore = data.minScore;
    if (data.dailyLimit !== undefined) this.props.dailyLimit = data.dailyLimit;
    if (data.timezone !== undefined) this.props.timezone = data.timezone;
    if (data.targetRoles !== undefined) this.props.targetRoles = data.targetRoles;
    if (data.targetLocations !== undefined) this.props.targetLocations = data.targetLocations;
    this.props.version += 1;
    this.props.updatedAt = data.now ?? new Date();
  }

  static create(props: { id: string; userId: string; now?: Date }): AutoApplyPolicy {
    const now = props.now ?? new Date();
    return new AutoApplyPolicy({
      id: props.id,
      userId: props.userId,
      enabled: false,
      minScore: 70,
      dailyLimit: 10,
      timezone: 'America/Sao_Paulo',
      targetRoles: [],
      targetLocations: [],
      version: 1,
      updatedAt: now,
    });
  }
}
