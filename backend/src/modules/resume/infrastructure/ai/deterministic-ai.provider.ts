import { Injectable } from '@nestjs/common';
import { AiProvider, TailoredContentResult } from '../../application/ports/ai-provider.port';
import { CandidateProfile } from '../../../candidate-profile/domain/candidate-profile.entity';
import { JobSnapshot } from '../../../catalog/domain/job.entity';

@Injectable()
export class DeterministicAiProvider implements AiProvider {
  async generateTailoredContent(profile: CandidateProfile, job: JobSnapshot): Promise<TailoredContentResult> {
    // Factual extraction without inventing any new skills or experience
    const candidateSkills = new Set(profile.skills.map((s) => s.toLowerCase().trim()));
    const jobDescriptionLower = job.description.toLowerCase();

    // Match candidate's real skills against job description
    const matchedSkills = profile.skills.filter((skill) =>
      jobDescriptionLower.includes(skill.toLowerCase().trim()),
    );

    // Calculate deterministic match score
    const skillScore = profile.skills.length > 0 ? (matchedSkills.length / profile.skills.length) * 50 : 0;
    const baseScore = profile.experiences && profile.experiences.length > 0 ? 40 : 20;
    const totalScore = Math.min(100, Math.round(baseScore + skillScore));

    const candidateName = profile.fullName || 'Profissional';
    const headline = profile.headline || `${job.title} especializado`;
    const matchSummary = `Perfil de ${candidateName} com aderência de ${totalScore}% à vaga de ${job.title}. Competências correspondentes: ${matchedSkills.join(', ') || 'qualificações gerais'}.`;

    return {
      matchScore: totalScore,
      matchSummary,
      tailoredHeadline: headline,
      tailoredSummary: `Profissional com experiência em ${matchedSkills.join(', ') || 'tecnologia'} alinhado aos objetivos da posição de ${job.title}.`,
      highlightedSkills: matchedSkills.length > 0 ? matchedSkills : profile.skills,
    };
  }
}
