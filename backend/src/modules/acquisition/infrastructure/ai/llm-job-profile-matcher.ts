import { Injectable } from '@nestjs/common';
import {
  JobProfileAiMatcher,
  CandidateProfileForAi,
  JobDataForAi,
  AiMatchEvaluationResult,
} from '../../application/ports/job-profile-ai-matcher.port';
import { NineRouterAiClient } from '@shared/infrastructure/ai/ninerouter-ai.client';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';

@Injectable()
export class LlmJobProfileMatcher implements JobProfileAiMatcher {
  constructor(
    private readonly aiClient: NineRouterAiClient,
    private readonly logger?: SanitizedLogger,
  ) {}

  async evaluateMatch(
    profile: CandidateProfileForAi,
    job: JobDataForAi,
  ): Promise<AiMatchEvaluationResult> {
    const systemPrompt = `Você é um avaliador técnico e recrutador de IA especializado em matching profissional e análise de carreiras via 9Router.
Analise a compatibilidade real entre o Perfil do Candidato e a Vaga de Emprego encontrada.

DIRETRIZES DE DECISÃO (ADR-0011 / ADR-0013):
1. Avalie se a vaga faz sentido para a área de atuação, especialidade e tecnologias dominadas pelo candidato.
2. Exemplo: se o candidato é especialista em Frontend e a vaga for de Backend puro ou DBA, rejeite (isMatch: false).
3. Se a vaga for compatível com a especialidade e tecnologias do candidato, aprove (isMatch: true).
4. Retorne ESTRITAMENTE um objeto JSON válido (sem comentários, sem markdown).`;

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

    // Execução estrita via 9Router sem fallback heurístico
    return this.aiClient.generateStructuredJson<AiMatchEvaluationResult>(
      systemPrompt,
      userPrompt,
    );
  }
}
