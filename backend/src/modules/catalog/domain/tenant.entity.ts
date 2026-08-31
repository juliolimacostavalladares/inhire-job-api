export interface TenantProps {
  id: string;
  slug: string;
  name: string;
  officialUrl: string;
  isActive: boolean;
  lastCollectedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Tenant {
  constructor(private readonly props: TenantProps) {}

  get id(): string {
    return this.props.id;
  }

  get slug(): string {
    return this.props.slug;
  }

  get name(): string {
    return this.props.name;
  }

  get officialUrl(): string {
    return this.props.officialUrl;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get lastCollectedAt(): Date | null | undefined {
    return this.props.lastCollectedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  update(data: { name?: string; officialUrl?: string; isActive?: boolean; lastCollectedAt?: Date; now?: Date }): void {
    if (data.name !== undefined) this.props.name = data.name;
    if (data.officialUrl !== undefined) this.props.officialUrl = data.officialUrl;
    if (data.isActive !== undefined) this.props.isActive = data.isActive;
    if (data.lastCollectedAt !== undefined) this.props.lastCollectedAt = data.lastCollectedAt;
    this.props.updatedAt = data.now ?? new Date();
  }

  static create(props: { id: string; slug: string; name: string; officialUrl: string; isActive?: boolean; now?: Date }): Tenant {
    const now = props.now ?? new Date();
    return new Tenant({
      id: props.id,
      slug: props.slug.trim().toLowerCase(),
      name: props.name.trim(),
      officialUrl: props.officialUrl.trim(),
      isActive: props.isActive ?? true,
      lastCollectedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}
