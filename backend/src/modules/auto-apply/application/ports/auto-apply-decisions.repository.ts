import { AutoApplyDecision } from '../../domain/auto-apply-decision.entity';

export interface AutoApplyDecisionsRepository {
  countAcceptedForDate(userId: string, evaluationDate: string): Promise<number>;
  findByUserAndDate(userId: string, evaluationDate: string): Promise<AutoApplyDecision[]>;
  findByUserAndJob(userId: string, jobId: string): Promise<AutoApplyDecision | null>;
  save(decision: AutoApplyDecision): Promise<AutoApplyDecision>;
}

export const AUTO_APPLY_DECISIONS_REPOSITORY = Symbol('AutoApplyDecisionsRepository');
