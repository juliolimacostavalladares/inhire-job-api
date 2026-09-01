import { Injectable } from '@nestjs/common';
import { AiProvider, TailoredContentResult } from '../../application/ports/ai-provider.port';
import { CandidateProfile } from '../../../candidate-profile/domain/candidate-profile.entity';
import { JobSnapshot } from '../../../catalog/domain/job.entity';
import { NineRouterAiClient } from '@shared/infrastructure/ai/ninerouter-ai.client';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';

interface RawAiTailorResponse {
  markdown: string;
  targetRole?: string;
  matchScore: number;
  summary?: string;
  matchSummary?: string;
  tailoredHeadline?: string;
  tailoredSummary?: string;
  highlightedKeywords?: string[];
  highlightedSkills?: string[];
}

@Injectable()
export class NineRouterAiResumeProvider implements AiProvider {
  constructor(
    private readonly aiClient: NineRouterAiClient,
    private readonly logger?: SanitizedLogger,
  ) {}

  async generateTailoredContent(profile: CandidateProfile, job: JobSnapshot): Promise<TailoredContentResult> {
    const candidateName = profile.fullName || 'Profissional';
    const email = profile.email || '';
    const phone = profile.phone || '';
    const city = profile.location?.city || '';
    const country = profile.location?.country || '';
    const locationStr = [city, country].filter(Boolean).join(', ');

    const candidateContext = {
      name: candidateName,
      email,
      phone,
      location: locationStr,
      headline: profile.headline || '',
      skills: profile.skills || [],
      experiences: profile.experiences || [],
      education: profile.education || [],
    };

    const jobContext = {
      title: job.title,
      location: job.location || '',
      workplaceType: job.workplaceType || '',
      description: job.description || '',
    };

    const markdownTemplate = `<div style="font-size: 2.2em; font-weight: bold; margin-top: 0px; margin-bottom: 4px;">${candidateName.toUpperCase()}</div>
<div style="font-size: 1.05em; font-weight: 600; margin-bottom: 6px; color: #1e293b;">Título Profissional Alinhado à Vaga</div>
<div style="font-size: 0.9em; margin-bottom: 4px; color: #475569;">${locationStr ? `${locationStr} | ` : ''}${phone ? `${phone} | ` : ''}${email ? `<a href="mailto:${email}">${email}</a>` : ''}</div>
<div style="font-size: 0.9em; color: #334155; font-style: italic;">Foco em: [Diferencial e competências chave para esta vaga]</div>

---

### RESUMO PROFISSIONAL
[Parágrafo conciso e impactante destacando anos de experiência, especialidade, impacto com as tecnologias pedidas na vaga e diferencial competitivo com IA/eficiência]

---

### EXPERIÊNCIA PROFISSIONAL

**Cargo Alinhado | Nome da Empresa**
*Mês Ano – Mês Ano (Duração) | Localização ou Remoto*
*   **Ação & Tecnologia:** Descrição com métricas, verbos fortes e palavras-chave em **negrito**.
*   **Impacto no Negócio:** Outro feito mensurável relevante.

---

### HABILIDADES TÉCNICAS

*   **Categoria / Domínio Principal:** Lista de tecnologias em **negrito** e ferramentas dominadas.
*   **Ferramentas, Metodologias & IA:** Tecnologias adicionais e diferenciais.
*   **Soft Skills & Práticas:** Práticas relevantes.

---

### FORMAÇÃO ACADÊMICA & CERTIFICAÇÕES

*   **Nome do Curso/Grau** | Instituição (Ano Início – Ano Fim)`;

    const systemPrompt = `Você é um Consultor Especialista em Carreira Tech e Otimização de Currículos para ATS (Applicant Tracking Systems).
Sua missão é adaptar o perfil real do candidato para a vaga alvo, gerando um currículo Markdown de altíssimo impacto no padrão formal ATS.

REGRAS INEGOCIÁVEIS (ADR-0011 / RES-FR-02):
1. VERACIDADE ABSOLUTA: Use EXCLUSIVAMENTE as experiências, empresas, períodos, cargos reais e habilidades declaradas pelo candidato. NUNCA invente fatos, empresas ou qualificações inexistentes.
2. ENQUADRAMENTO ESTRATÉGICO: Reorganize e reescreva os bullet points para evidenciar impacto, tecnologias e requisitos da vaga alvo.
3. MÉTRICAS E PALAVRAS-CHAVE: Destaque tecnologias e métricas em **negrito**.
4. VERBOS DE AÇÃO: Inicie cada bullet point com verbos assertivos (ex: "Desenvolvi", "Liderei", "Implementei", "Arquitetei").
5. IDIOMA: Português do Brasil.

FORMATO DE SAÍDA OBRIGATÓRIO — RETORNE APENAS UM OBJETO JSON VÁLIDO:
{
  "markdown": "<currículo completo em Markdown seguindo rigorosamente o template abaixo, com todas as seções e dados reais do candidato preenchidos>",
  "targetRole": "<cargo alvo alinhado à vaga>",
  "matchScore": <número inteiro de 0 a 100 representando o % de aderência à vaga>,
  "summary": "<1-2 frases explicando a estratégia de alinhamento do perfil à vaga>",
  "highlightedKeywords": ["<keyword1>", "<keyword2>", "<até 10 palavras-chave técnicas da vaga presentes no perfil>"]
}

TEMPLATE DO CAMPO "markdown" (use exatamente esta estrutura de tags e seções):
${markdownTemplate}`;

    const userPrompt = `CANDIDATO:
${JSON.stringify(candidateContext, null, 2)}

VAGA ALVO:
${JSON.stringify(jobContext, null, 2)}

Retorne SOMENTE o objeto JSON conforme o formato especificado. NÃO escreva nenhum texto fora do JSON.`;

    try {
      const parsed = await this.aiClient.generateStructuredJson<RawAiTailorResponse>(
        systemPrompt,
        userPrompt,
      );

      const matchScore = typeof parsed.matchScore === 'number' && !isNaN(parsed.matchScore)
        ? Math.min(100, Math.max(0, Math.round(parsed.matchScore)))
        : 85;

      const highlightedSkills = Array.isArray(parsed.highlightedKeywords) && parsed.highlightedKeywords.length > 0
        ? parsed.highlightedKeywords
        : Array.isArray(parsed.highlightedSkills) && parsed.highlightedSkills.length > 0
          ? parsed.highlightedSkills
          : profile.skills;

      const tailoredHeadline = parsed.targetRole || parsed.tailoredHeadline || profile.headline || job.title;
      const tailoredSummary = parsed.summary || parsed.tailoredSummary || `Profissional com perfil altamente alinhado aos requisitos da vaga de ${job.title}.`;
      const matchSummary = parsed.summary || parsed.matchSummary || `Perfil de ${candidateName} com aderência estimada de ${matchScore}% para a posição de ${job.title}.`;

      return {
        matchScore,
        matchSummary,
        tailoredHeadline,
        tailoredSummary,
        highlightedSkills,
        markdown: parsed.markdown,
      };
    } catch (err: unknown) {
      if (this.logger) {
        this.logger.error(
          {
            operation: 'ninerouter_resume_tailoring_failed',
            error: (err as Error).message,
          },
          'NineRouterAiResumeProvider',
        );
      }
      throw err;
    }
  }
}
