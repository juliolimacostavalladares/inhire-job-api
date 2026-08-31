import { Injectable } from '@nestjs/common';
import {
  JobProfileAiMatcher,
  CandidateProfileForAi,
  JobDataForAi,
  AiMatchEvaluationResult,
} from '../../application/ports/job-profile-ai-matcher.port';
import { OpenRouterAiClient } from '@shared/infrastructure/ai/openrouter-ai.client';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';

@Injectable()
export class LlmJobProfileMatcher implements JobProfileAiMatcher {
  constructor(
    private readonly aiClient: OpenRouterAiClient,
    private readonly logger?: SanitizedLogger,
  ) {}

  async evaluateMatch(
    profile: CandidateProfileForAi,
    job: JobDataForAi,
  ): Promise<AiMatchEvaluationResult> {
    const systemPrompt = `Você é um avaliador técnico e recrutador de IA especializado em matching profissional e análise de carreiras.
Analise a compatibilidade real entre o Perfil do Candidato e a Vaga de Emprego encontrada.

DIRETRIZES DE DECISÃO (ADR-0011 / ADR-0013):
1. Avalie se a vaga faz sentido para a área de atuação, especialidade e tecnologias dominadas pelo candidato.
2. Exemplo: se o candidato é especialista em Frontend e a vaga for de Backend puro ou DBA, rejeite (isMatch: false).
3. Se a vaga for compatível com a especialidade e tecnologias do candidato, aprove (isMatch: true).
4. Retorne ESTRITAMENTE um objeto JSON válido.`;

    const userPrompt = `PERFIL DO CANDIDATO:
- Headline / Cargo Atual: ${profile.headline || 'Não informado'}
- Habilidades / Tecnologias: ${profile.skills.join(', ') || 'Não informadas'}
- Cargos Desejados: ${profile.targetRoles?.join(', ') || 'Não informados'}
- Experiências: ${JSON.stringify(profile.experiences || [])}

VAGA DE EMPREGO:
- Título da Vaga: ${job.title}
- Descrição / Requisitos: ${job.description}
- Localidade: ${job.location || 'Não informada'}

Retorne exatamente a estrutura JSON:
{
  "isMatch": boolean,
  "matchScore": number,
  "reason": "explicação concisa da decisão da IA"
}`;

    const fallback = this.evaluateWithSemanticAnalyzer(profile, job);

    return this.aiClient.generateStructuredJson<AiMatchEvaluationResult>(
      systemPrompt,
      userPrompt,
      fallback,
    );
  }

  /**
   * Avaliador semântico estruturado para análise sem dependência de API externa
   */
  private evaluateWithSemanticAnalyzer(
    profile: CandidateProfileForAi,
    job: JobDataForAi,
  ): AiMatchEvaluationResult {
    let score = 0;
    const reasons: string[] = [];

    const jobTitleTokens = this.tokenize(job.title);

    // 1. Avaliar compatibilidade do Cargo / Headline do candidato
    if (profile.headline) {
      const headlineTokens = this.tokenize(profile.headline);
      const headlineOverlap = this.calculateOverlap(headlineTokens, jobTitleTokens);
      if (headlineOverlap > 0) {
        score += Math.min(50, headlineOverlap * 25);
        reasons.push(`Headline "${profile.headline}" tem alta aderência com o título da vaga`);
      }
    }

    // 2. Avaliar Cargos Desejados (targetRoles)
    if (profile.targetRoles && profile.targetRoles.length > 0) {
      for (const role of profile.targetRoles) {
        const roleTokens = this.tokenize(role);
        const roleOverlap = this.calculateOverlap(roleTokens, jobTitleTokens);
        if (roleOverlap > 0) {
          score += Math.min(40, roleOverlap * 20);
          reasons.push(`Cargo almejado "${role}" compatível com a vaga`);
          break;
        }
      }
    }

    // 3. Avaliar Habilidades e Tecnologias (skills)
    if (profile.skills && profile.skills.length > 0) {
      const matchedSkills: string[] = [];
      for (const skill of profile.skills) {
        const cleanSkill = skill.toLowerCase().trim();
        if (cleanSkill.length > 1) {
          if (
            job.title.toLowerCase().includes(cleanSkill) ||
            job.description.toLowerCase().includes(cleanSkill)
          ) {
            matchedSkills.push(skill);
          }
        }
      }

      if (matchedSkills.length > 0) {
        const skillScore = Math.min(40, matchedSkills.length * 10);
        score += skillScore;
        reasons.push(`Habilidades requeridas encontradas no perfil: ${matchedSkills.join(', ')}`);
      }
    }

    // 4. Avaliar histórico de experiências
    if (profile.experiences && Array.isArray(profile.experiences)) {
      for (const exp of profile.experiences) {
        if (exp.role) {
          const expTokens = this.tokenize(exp.role);
          const expOverlap = this.calculateOverlap(expTokens, jobTitleTokens);
          if (expOverlap > 0) {
            score += Math.min(20, expOverlap * 10);
            reasons.push(`Experiência prévia em "${exp.role}" valorizada para a vaga`);
            break;
          }
        }
      }
    }

    const finalScore = Math.min(100, Math.max(0, score));
    const isMatch = finalScore >= 35; // Limiar de relevância da IA

    return {
      isMatch,
      matchScore: finalScore,
      reason: isMatch
        ? `IA aprovou relevância (Score: ${finalScore}/100): ${reasons.join('; ')}`
        : `IA reprovou compatibilidade (Score: ${finalScore}/100): vaga não possui aderência suficiente ao perfil profissional informado.`,
    };
  }

  private tokenize(text: string): Set<string> {
    const STOP_WORDS = new Set([
      'de', 'da', 'do', 'dos', 'das', 'em', 'para', 'com', 'sem', 'por', 'que', 'como',
      'senior', 'sênior', 'pleno', 'junior', 'júnior', 'lead', 'staff', 'principal',
      'pessoa', 'vaga', 'oportunidade', 'analista', 'especialista', 'gerente', 'coordenador',
    ]);

    const words = (text || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[\s/\\,\-()[\]|]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    return new Set(words);
  }

  private calculateOverlap(setA: Set<string>, setB: Set<string>): number {
    let matches = 0;
    for (const item of setA) {
      if (setB.has(item)) {
        matches++;
      }
    }
    return matches;
  }
}
