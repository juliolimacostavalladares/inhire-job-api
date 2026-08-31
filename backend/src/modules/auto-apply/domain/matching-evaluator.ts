import { CandidateProfile } from '../../candidate-profile/domain/candidate-profile.entity';
import { JobSnapshot } from '../../catalog/domain/job.entity';
import { AutoApplyPolicy } from './auto-apply-policy.entity';

export interface MatchingEvaluationResult {
  score: number;
  isEligible: boolean;
  reason: string;
}

export class MatchingEvaluator {
  static evaluate(profile: CandidateProfile, job: JobSnapshot, policy: AutoApplyPolicy): MatchingEvaluationResult {
    let score = 50; // base score for active published job
    const reasons: string[] = [];

    // Role matching
    if (policy.targetRoles.length > 0) {
      const jobTitleLower = job.title.toLowerCase();
      const roleMatches = policy.targetRoles.some((role) => jobTitleLower.includes(role.toLowerCase().trim()));
      if (roleMatches) {
        score += 25;
        reasons.push('Title matches target roles');
      } else {
        score -= 20;
        reasons.push('Title does not match target roles');
      }
    }

    // Skills matching
    const jobDescriptionLower = job.description.toLowerCase();
    const matchedSkills = profile.skills.filter((s) => jobDescriptionLower.includes(s.toLowerCase().trim()));
    if (matchedSkills.length > 0) {
      const skillBonus = Math.min(25, matchedSkills.length * 5);
      score += skillBonus;
      reasons.push(`Matched skills: ${matchedSkills.join(', ')}`);
    }

    const finalScore = Math.max(0, Math.min(100, score));
    const isEligible = finalScore >= policy.minScore;

    return {
      score: finalScore,
      isEligible,
      reason: isEligible
        ? `Score ${finalScore} >= minimum ${policy.minScore}. ${reasons.join('; ')}`
        : `Score ${finalScore} < minimum ${policy.minScore}. ${reasons.join('; ')}`,
    };
  }
}
