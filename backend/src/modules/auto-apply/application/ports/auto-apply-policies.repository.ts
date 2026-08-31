import { AutoApplyPolicy } from '../../domain/auto-apply-policy.entity';

export interface AutoApplyPoliciesRepository {
  findByUserId(userId: string): Promise<AutoApplyPolicy | null>;
  save(policy: AutoApplyPolicy): Promise<AutoApplyPolicy>;
}

export const AUTO_APPLY_POLICIES_REPOSITORY = Symbol('AutoApplyPoliciesRepository');
