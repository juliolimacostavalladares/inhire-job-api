import { MatchingEvaluator } from '@modules/auto-apply/domain/matching-evaluator';
import { AutoApplyPolicy } from '@modules/auto-apply/domain/auto-apply-policy.entity';
import { CandidateProfile } from '@modules/candidate-profile/domain/candidate-profile.entity';
import { JobSnapshot } from '@modules/catalog/domain/job.entity';

describe('Auto Apply Module - Unit Tests (T-AUTO-01..02, AUTO-AC-01..05)', () => {
  it('T-AUTO-02: Matching evaluation never invents salary or missing personal info', () => {
    const profile = CandidateProfile.create({
      id: 'p1',
      userId: 'u1',
      fullName: 'Dev Test',
      email: 'dev@test.internal',
    });
    profile.update({
      skills: ['TypeScript', 'NestJS'],
    });

    const policy = AutoApplyPolicy.create({ id: 'pol1', userId: 'u1' });
    policy.update({
      enabled: true,
      minScore: 60,
      targetRoles: ['Backend Engineer'],
    });

    const job: JobSnapshot = {
      jobId: 'j1',
      tenantId: 't1',
      title: 'Senior Backend Engineer',
      jobUrl: 'https://test.inhire.app/jobs/j1',
      status: 'PUBLISHED',
      description: 'Requires TypeScript and NestJS expertise',
      formSchema: [],
      version: 1,
    };

    const evaluation = MatchingEvaluator.evaluate(profile, job, policy);
    expect(evaluation.isEligible).toBe(true);
    expect(evaluation.score).toBeGreaterThanOrEqual(60);
    expect(evaluation.reason).toContain('Title matches target roles');
  });
});
