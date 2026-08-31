export type RunType = 'DISCOVERY' | 'COLLECTION';
export type RunTrigger = 'SCHEDULED' | 'ADMIN_MANUAL';
export type RunStatus = 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED';

export interface CrawlItemProps {
  id: string;
  runId: string;
  tenantId?: string | null;
  status: 'SUCCEEDED' | 'FAILED';
  jobsCollected: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: Date;
}

export interface CrawlRunProps {
  id: string;
  type: RunType;
  trigger: RunTrigger;
  status: RunStatus;
  totalTenants: number;
  processedTenants: number;
  totalJobsFound: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt: Date;
  finishedAt?: Date | null;
  items?: CrawlItemProps[];
}

export class CrawlRun {
  constructor(private readonly props: CrawlRunProps) {}

  get id(): string {
    return this.props.id;
  }

  get type(): RunType {
    return this.props.type;
  }

  get trigger(): RunTrigger {
    return this.props.trigger;
  }

  get status(): RunStatus {
    return this.props.status;
  }

  get totalTenants(): number {
    return this.props.totalTenants;
  }

  get processedTenants(): number {
    return this.props.processedTenants;
  }

  get totalJobsFound(): number {
    return this.props.totalJobsFound;
  }

  get errorCode(): string | null | undefined {
    return this.props.errorCode;
  }

  get errorMessage(): string | null | undefined {
    return this.props.errorMessage;
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get finishedAt(): Date | null | undefined {
    return this.props.finishedAt;
  }

  get items(): CrawlItemProps[] {
    return this.props.items ?? [];
  }

  recordTenantResult(status: 'SUCCEEDED' | 'FAILED', jobsFound: number, now: Date = new Date()): void {
    this.props.processedTenants += 1;
    if (status === 'SUCCEEDED') {
      this.props.totalJobsFound += jobsFound;
    }

    if (this.props.processedTenants >= this.props.totalTenants) {
      this.finish(now);
    }
  }

  finish(now: Date = new Date()): void {
    this.props.finishedAt = now;
    if (this.props.processedTenants === 0 && this.props.totalTenants > 0) {
      this.props.status = 'FAILED';
    } else if (this.props.processedTenants < this.props.totalTenants) {
      this.props.status = 'PARTIAL';
    } else {
      this.props.status = 'SUCCEEDED';
    }
  }

  fail(errorCode: string, errorMessage: string, now: Date = new Date()): void {
    this.props.status = 'FAILED';
    this.props.errorCode = errorCode;
    this.props.errorMessage = errorMessage;
    this.props.finishedAt = now;
  }

  static create(props: { id: string; type: RunType; trigger: RunTrigger; totalTenants: number; now?: Date }): CrawlRun {
    const now = props.now ?? new Date();
    return new CrawlRun({
      id: props.id,
      type: props.type,
      trigger: props.trigger,
      status: 'RUNNING',
      totalTenants: props.totalTenants,
      processedTenants: 0,
      totalJobsFound: 0,
      startedAt: now,
      items: [],
    });
  }
}
