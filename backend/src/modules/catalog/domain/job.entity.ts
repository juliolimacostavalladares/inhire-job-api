import { AppError } from '@shared/domain/errors/app-error';

export type JobStatus = 'PUBLISHED' | 'CLOSED';

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FormFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'file' | 'textarea' | 'checkbox';
  required: boolean;
  options?: FormFieldOption[];
}

export interface JobProps {
  id: string;
  tenantId: string;
  externalId: string;
  title: string;
  url: string;
  status: JobStatus;
  description: string;
  location?: string | null;
  formSchema: FormFieldSchema[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobSnapshot {
  jobId: string;
  tenantId: string;
  title: string;
  jobUrl: string;
  status: JobStatus;
  description: string;
  location?: string | null;
  formSchema: FormFieldSchema[];
  version: number;
}

export class Job {
  constructor(private readonly props: JobProps) {}

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get externalId(): string {
    return this.props.externalId;
  }

  get title(): string {
    return this.props.title;
  }

  get url(): string {
    return this.props.url;
  }

  get status(): JobStatus {
    return this.props.status;
  }

  get description(): string {
    return this.props.description;
  }

  get location(): string | null | undefined {
    return this.props.location;
  }

  get formSchema(): FormFieldSchema[] {
    return this.props.formSchema;
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

  static validateCanonicalUrl(url: string): void {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        throw AppError.jobUrlNotAllowed('Job URL must use HTTPS');
      }
      // Must be under *.inhire.app or inhire.app (or localhost/mock in test fixtures)
      const hostname = parsed.hostname.toLowerCase();
      const isAllowedHost = hostname === 'inhire.app' || hostname.endsWith('.inhire.app') || hostname === 'localhost' || hostname === '127.0.0.1';
      if (!isAllowedHost) {
        throw AppError.jobUrlNotAllowed(`Job URL host '${hostname}' is not permitted`);
      }
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      throw AppError.jobUrlNotAllowed('Invalid job URL format');
    }
  }

  update(data: { title?: string; description?: string; location?: string; formSchema?: FormFieldSchema[]; status?: JobStatus; now?: Date }): void {
    if (data.title !== undefined) this.props.title = data.title;
    if (data.description !== undefined) this.props.description = data.description;
    if (data.location !== undefined) this.props.location = data.location;
    if (data.formSchema !== undefined) this.props.formSchema = data.formSchema;
    if (data.status !== undefined) this.props.status = data.status;
    this.props.version += 1;
    this.props.updatedAt = data.now ?? new Date();
  }

  close(now: Date = new Date()): void {
    this.props.status = 'CLOSED';
    this.props.version += 1;
    this.props.updatedAt = now;
  }

  toSnapshot(): JobSnapshot {
    return {
      jobId: this.props.id,
      tenantId: this.props.tenantId,
      title: this.props.title,
      jobUrl: this.props.url, // Exact byte-for-byte URL
      status: this.props.status,
      description: this.props.description,
      location: this.props.location,
      formSchema: [...this.props.formSchema],
      version: this.props.version,
    };
  }

  static create(props: {
    id: string;
    tenantId: string;
    externalId: string;
    title: string;
    url: string;
    description: string;
    location?: string;
    formSchema?: FormFieldSchema[];
    status?: JobStatus;
    now?: Date;
  }): Job {
    Job.validateCanonicalUrl(props.url);
    const now = props.now ?? new Date();
    return new Job({
      id: props.id,
      tenantId: props.tenantId,
      externalId: props.externalId,
      title: props.title,
      url: props.url,
      status: props.status ?? 'PUBLISHED',
      description: props.description,
      location: props.location || null,
      formSchema: props.formSchema ?? [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }
}
