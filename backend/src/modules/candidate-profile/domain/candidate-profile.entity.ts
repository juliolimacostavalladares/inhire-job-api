import { AppError } from '@shared/domain/errors/app-error';

export type ProfileStatus = 'PENDING_IMPORT' | 'PROCESSING' | 'NEEDS_REVIEW' | 'COMPLETE' | 'FAILED';

export interface LocationInfo {
  country?: string;
  state?: string;
  city?: string;
}

export interface ExperienceInfo {
  company: string;
  role: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  current?: boolean;
}

export interface EducationInfo {
  institution: string;
  degree?: string;
  field?: string;
  graduationYear?: number;
}

export interface CandidateProfileProps {
  id: string;
  userId: string;
  status: ProfileStatus;
  version: number;
  fullName?: string | null;
  headline?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: LocationInfo | null;
  experiences?: ExperienceInfo[] | null;
  education?: EducationInfo[] | null;
  skills: string[];
  rawResumeArtifactId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReadinessResult {
  ready: boolean;
  missingFields: string[];
  version: number;
}

export class CandidateProfile {
  constructor(private readonly props: CandidateProfileProps) {}

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get status(): ProfileStatus {
    return this.props.status;
  }

  get version(): number {
    return this.props.version;
  }

  get fullName(): string | null | undefined {
    return this.props.fullName;
  }

  get headline(): string | null | undefined {
    return this.props.headline;
  }

  get email(): string | null | undefined {
    return this.props.email;
  }

  get phone(): string | null | undefined {
    return this.props.phone;
  }

  get location(): LocationInfo | null | undefined {
    return this.props.location;
  }

  get experiences(): ExperienceInfo[] | null | undefined {
    return this.props.experiences;
  }

  get education(): EducationInfo[] | null | undefined {
    return this.props.education;
  }

  get skills(): string[] {
    return this.props.skills;
  }

  get rawResumeArtifactId(): string | null | undefined {
    return this.props.rawResumeArtifactId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  assessReadiness(purpose: 'SUBMISSION' | 'TAILORED_RESUME'): ReadinessResult {
    const missing: string[] = [];

    if (!this.props.fullName?.trim()) missing.push('fullName');
    if (!this.props.email?.trim()) missing.push('email');

    if (purpose === 'SUBMISSION') {
      if (!this.props.phone?.trim()) missing.push('phone');
      if (!this.props.location?.country?.trim()) missing.push('location.country');
      if (!this.props.location?.city?.trim()) missing.push('location.city');
      const hasExp = this.props.experiences && this.props.experiences.length > 0;
      const hasEdu = this.props.education && this.props.education.length > 0;
      if (!hasExp && !hasEdu) missing.push('experiences_or_education');
    }

    if (purpose === 'TAILORED_RESUME') {
      const hasExp = this.props.experiences && this.props.experiences.length > 0;
      const hasEdu = this.props.education && this.props.education.length > 0;
      const hasSkills = this.props.skills && this.props.skills.length > 0;
      if (!hasExp && !hasEdu && !hasSkills) missing.push('experiences_or_skills');
    }

    return {
      ready: missing.length === 0,
      missingFields: missing,
      version: this.props.version,
    };
  }

  update(data: Partial<Omit<CandidateProfileProps, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>, expectedVersion?: number): void {
    if (expectedVersion !== undefined && expectedVersion !== this.props.version) {
      throw AppError.invalidStateTransition(`Optimistic concurrency conflict: expected version ${expectedVersion} but got ${this.props.version}`);
    }

    if (data.fullName !== undefined) this.props.fullName = data.fullName;
    if (data.headline !== undefined) this.props.headline = data.headline;
    if (data.email !== undefined) this.props.email = data.email;
    if (data.phone !== undefined) this.props.phone = data.phone;
    if (data.location !== undefined) this.props.location = data.location;
    if (data.experiences !== undefined) this.props.experiences = data.experiences;
    if (data.education !== undefined) this.props.education = data.education;
    if (data.skills !== undefined) this.props.skills = data.skills;
    if (data.status !== undefined) this.props.status = data.status;
    if (data.rawResumeArtifactId !== undefined) this.props.rawResumeArtifactId = data.rawResumeArtifactId;

    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  prepareApplicationData(requiredFields: string[]): Record<string, unknown> {
    const snapshot: Record<string, unknown> = {};
    for (const field of requiredFields) {
      switch (field) {
        case 'fullName':
        case 'name':
          snapshot[field] = this.props.fullName || '';
          break;
        case 'email':
          snapshot[field] = this.props.email || '';
          break;
        case 'phone':
          snapshot[field] = this.props.phone || '';
          break;
        case 'country':
          snapshot[field] = this.props.location?.country || '';
          break;
        case 'state':
          snapshot[field] = this.props.location?.state || '';
          break;
        case 'city':
          snapshot[field] = this.props.location?.city || '';
          break;
        default:
          break;
      }
    }
    return snapshot;
  }

  static create(props: { id: string; userId: string; email?: string; fullName?: string; now?: Date }): CandidateProfile {
    const now = props.now ?? new Date();
    return new CandidateProfile({
      id: props.id,
      userId: props.userId,
      status: 'PENDING_IMPORT',
      version: 1,
      fullName: props.fullName || null,
      headline: null,
      email: props.email || null,
      phone: null,
      location: null,
      experiences: [],
      education: [],
      skills: [],
      rawResumeArtifactId: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}
