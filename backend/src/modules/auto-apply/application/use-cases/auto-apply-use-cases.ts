import { Injectable, Inject } from '@nestjs/common';
import { AUTO_APPLY_POLICIES_REPOSITORY, AutoApplyPoliciesRepository } from '../ports/auto-apply-policies.repository';
import { AUTO_APPLY_DECISIONS_REPOSITORY, AutoApplyDecisionsRepository } from '../ports/auto-apply-decisions.repository';
import { CANDIDATE_PROFILE_SERVICE, CandidateProfileService } from '../../../candidate-profile/application/ports/candidate-profile-service.interface';
import { JOBS_REPOSITORY, JobsRepository } from '../../../catalog/application/ports/jobs.repository';
import { JOB_APPLICATIONS_REPOSITORY, JobApplicationsRepository } from '../../../applications/application/ports/job-applications.repository';
import { QueueJobApplicationUseCase } from '../../../applications/application/use-cases/application-use-cases';
import { AutoApplyPolicy } from '../../domain/auto-apply-policy.entity';
import { AutoApplyDecision } from '../../domain/auto-apply-decision.entity';
import { MatchingEvaluator } from '../../domain/matching-evaluator';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';

@Injectable()
export class GetPolicyUseCase {
  constructor(
    @Inject(AUTO_APPLY_POLICIES_REPOSITORY) private readonly policyRepo: AutoApplyPoliciesRepository,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
  ) {}

  async execute(userId: string): Promise<AutoApplyPolicy> {
    let policy = await this.policyRepo.findByUserId(userId);
    if (!policy) {
      policy = AutoApplyPolicy.create({
        id: this.idGenerator.generate(),
        userId,
        now: this.clock.now(),
      });
      await this.policyRepo.save(policy);
    }
    return policy;
  }
}

@Injectable()
export class UpdatePolicyUseCase {
  constructor(
    private readonly getPolicyUseCase: GetPolicyUseCase,
    @Inject(AUTO_APPLY_POLICIES_REPOSITORY) private readonly policyRepo: AutoApplyPoliciesRepository,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
  ) {}

  async execute(
    userId: string,
    data: {
      enabled?: boolean;
      minScore?: number;
      dailyLimit?: number;
      timezone?: string;
      targetRoles?: string[];
      targetLocations?: string[];
    },
  ): Promise<AutoApplyPolicy> {
    const policy = await this.getPolicyUseCase.execute(userId);
    policy.update({ ...data, now: this.clock.now() });
    return this.policyRepo.save(policy);
  }
}

@Injectable()
export class EvaluateAutoApplyUseCase {
  constructor(
    private readonly getPolicyUseCase: GetPolicyUseCase,
    @Inject(AUTO_APPLY_DECISIONS_REPOSITORY) private readonly decisionsRepo: AutoApplyDecisionsRepository,
    @Inject(CANDIDATE_PROFILE_SERVICE) private readonly profileService: CandidateProfileService,
    @Inject(JOBS_REPOSITORY) private readonly jobsRepo: JobsRepository,
    @Inject(JOB_APPLICATIONS_REPOSITORY) private readonly applicationsRepo: JobApplicationsRepository,
    private readonly queueJobApplicationUseCase: QueueJobApplicationUseCase,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
    private readonly logger: SanitizedLogger,
  ) {}

  async execute(userId: string, evaluationDate?: string): Promise<{ evaluated: number; applied: number; skipped: number }> {
    const policy = await this.getPolicyUseCase.execute(userId);
    if (!policy.enabled) {
      return { evaluated: 0, applied: 0, skipped: 0 };
    }

    const todayDate = evaluationDate || this.clock.now().toISOString().split('T')[0];
    const acceptedToday = await this.decisionsRepo.countAcceptedForDate(userId, todayDate);
    const quotaRemaining = Math.max(0, policy.dailyLimit - acceptedToday);

    if (quotaRemaining <= 0) {
      return { evaluated: 0, applied: 0, skipped: 0 };
    }

    const readiness = await this.profileService.assessReadiness(userId, 'SUBMISSION');
    if (!readiness.ready) {
      return { evaluated: 0, applied: 0, skipped: 0 };
    }

    const profile = await this.profileService.getProfile(userId);
    const { items: publishedJobs } = await this.jobsRepo.findAll({ status: 'PUBLISHED', limit: 100 });

    let appliedCount = 0;
    let evaluatedCount = 0;
    let skippedCount = 0;

    for (const job of publishedJobs) {
      if (appliedCount >= quotaRemaining) break;

      // Check if already applied or already decided today
      const existingApp = await this.applicationsRepo.findByUserAndJob(userId, job.id);
      if (existingApp) continue;

      evaluatedCount++;
      const match = MatchingEvaluator.evaluate(profile, job.toSnapshot(), policy);

      const decision = AutoApplyDecision.create({
        id: this.idGenerator.generate(),
        userId,
        jobId: job.id,
        decision: match.isEligible ? 'ACCEPTED' : 'REJECTED',
        score: match.score,
        reason: match.reason,
        policyVersion: policy.version,
        profileVersion: profile.version,
        jobVersion: job.version,
        evaluationDate: todayDate,
        now: this.clock.now(),
      });

      await this.decisionsRepo.save(decision);

      if (match.isEligible) {
        await this.queueJobApplicationUseCase.execute(userId, job.id, {
          resumeMode: 'AI_TAILORED',
          autoApplied: true,
        });
        appliedCount++;
      } else {
        skippedCount++;
      }
    }

    return { evaluated: evaluatedCount, applied: appliedCount, skipped: skippedCount };
  }
}

@Injectable()
export class ListDecisionsUseCase {
  constructor(
    @Inject(AUTO_APPLY_DECISIONS_REPOSITORY) private readonly decisionsRepo: AutoApplyDecisionsRepository,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
  ) {}

  async execute(userId: string, date?: string): Promise<AutoApplyDecision[]> {
    const today = date || this.clock.now().toISOString().split('T')[0];
    return this.decisionsRepo.findByUserAndDate(userId, today);
  }
}
