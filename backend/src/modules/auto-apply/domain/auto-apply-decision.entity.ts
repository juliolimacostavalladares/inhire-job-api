export type DecisionType = 'ACCEPTED' | 'REJECTED';

export interface AutoApplyDecisionProps {
  id: string;
  userId: string;
  jobId: string;
  decision: DecisionType;
  score?: number | null;
  reason: string;
  policyVersion: number;
  profileVersion: number;
  jobVersion: number;
  evaluationDate: string; // YYYY-MM-DD
  createdAt: Date;
}

export class AutoApplyDecision {
  constructor(private readonly props: AutoApplyDecisionProps) {}

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get jobId(): string {
    return this.props.jobId;
  }

  get decision(): DecisionType {
    return this.props.decision;
  }

  get score(): number | null | undefined {
    return this.props.score;
  }

  get reason(): string {
    return this.props.reason;
  }

  get policyVersion(): number {
    return this.props.policyVersion;
  }

  get profileVersion(): number {
    return this.props.profileVersion;
  }

  get jobVersion(): number {
    return this.props.jobVersion;
  }

  get evaluationDate(): string {
    return this.props.evaluationDate;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  static create(props: {
    id: string;
    userId: string;
    jobId: string;
    decision: DecisionType;
    score?: number;
    reason: string;
    policyVersion: number;
    profileVersion: number;
    jobVersion: number;
    evaluationDate: string;
    now?: Date;
  }): AutoApplyDecision {
    return new AutoApplyDecision({
      id: props.id,
      userId: props.userId,
      jobId: props.jobId,
      decision: props.decision,
      score: props.score ?? null,
      reason: props.reason,
      policyVersion: props.policyVersion,
      profileVersion: props.profileVersion,
      jobVersion: props.jobVersion,
      evaluationDate: props.evaluationDate,
      createdAt: props.now ?? new Date(),
    });
  }
}
