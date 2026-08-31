import { Injectable } from '@nestjs/common';
import {
  ProfileAiExtractor,
  ExtractedProfileData,
} from '../../application/ports/profile-ai-extractor.port';
import { LocationInfo, ExperienceInfo, EducationInfo } from '../../domain/candidate-profile.entity';
import { NineRouterAiClient } from '@shared/infrastructure/ai/ninerouter-ai.client';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';

interface RawAiProfileResponse {
  fullName?: string | null;
  headline?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: {
    city?: string | null;
    state?: string | null;
    country?: string | null;
  } | null;
  skills?: string[];
  searchTerms?: string[];
  experiences?: Array<{
    company?: string;
    role?: string;
    startDate?: string | null;
    endDate?: string | null;
    description?: string | null;
    current?: boolean;
  }>;
  education?: Array<{
    institution?: string;
    degree?: string | null;
    field?: string | null;
    graduationYear?: number | null;
  }>;
}

@Injectable()
export class NineRouterProfileAiExtractor implements ProfileAiExtractor {
  constructor(
    private readonly aiClient: NineRouterAiClient,
    private readonly logger?: SanitizedLogger,
  ) {}

  async extractFromResumeText(resumeText: string): Promise<ExtractedProfileData> {
    const systemPrompt = `Você é um motor de Inteligência Artificial especialista em análise e extração estruturada de currículos profissionais via 9Router.
Analise o texto integral do documento e extraia com precisão rigorosa todas as informações do candidato em formato JSON estruturado.
Gere também uma lista de termos de busca inteligentes ("searchTerms") com palavras-chave, cargos e tecnologias centrais do perfil para busca de vagas no mercado.

DIRETRIZES FUNDAMENTAIS (ADR-0011 / CAND-FR-08):
1. NUNCA invente fatos, cargos, cursos, notas ou localidades que não estejam explicitamente no texto.
2. Se um campo não estiver no texto, defina-o como null ou array vazio [].
3. Em perfis do LinkedIn ou documentos estruturados, ignore títulos de seções secundárias como sendo o nome: identifique o Nome Completo real do candidato no cabeçalho principal do perfil.
4. Extraia todas as tecnologias, ferramentas e linguagens mencionadas no campo skills.
5. Em searchTerms, inclua as palavras-chave prioritárias para correspondência com vagas de emprego (ex: ["Frontend", "Front-end", "React", "TypeScript", "Next.js", "Software Engineer"]).
6. Retorne ESTRITAMENTE um objeto JSON válido (sem blocos de texto adicionais).`;

    const userPrompt = `Analise o texto do currículo abaixo e extraia todos os atributos do perfil do candidato:

TEXTO DO CURRÍCULO:
"""
${resumeText}
"""

Retorne exatamente a seguinte estrutura JSON:
{
  "fullName": string | null,
  "headline": string | null,
  "email": string | null,
  "phone": string | null,
  "location": {
    "city": string | null,
    "state": string | null,
    "country": string | null
  } | null,
  "skills": ["string"],
  "searchTerms": ["string"],
  "experiences": [
    {
      "company": "string",
      "role": "string",
      "startDate": "string | null",
      "endDate": "string | null",
      "description": "string | null",
      "current": boolean
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string | null",
      "field": "string | null",
      "graduationYear": "number | null"
    }
  ]
}`;

    // Chamada direta à IA via 9Router (sem fallback heurístico manual)
    const parsed = await this.aiClient.generateStructuredJson<RawAiProfileResponse>(
      systemPrompt,
      userPrompt,
    );

    const location: LocationInfo | null = parsed.location
      ? {
          city: parsed.location.city || undefined,
          state: parsed.location.state || undefined,
          country: parsed.location.country || undefined,
        }
      : null;

    const experiences: ExperienceInfo[] = Array.isArray(parsed.experiences)
      ? parsed.experiences
          .filter((e) => e.company && e.role)
          .map((e) => ({
            company: String(e.company),
            role: String(e.role),
            startDate: e.startDate || undefined,
            endDate: e.endDate || undefined,
            description: e.description || undefined,
            current: Boolean(e.current),
          }))
      : [];

    const education: EducationInfo[] = Array.isArray(parsed.education)
      ? parsed.education
          .filter((ed) => ed.institution)
          .map((ed) => ({
            institution: String(ed.institution),
            degree: ed.degree || undefined,
            field: ed.field || undefined,
            graduationYear: ed.graduationYear || undefined,
          }))
      : [];

    const skills: string[] = Array.isArray(parsed.skills)
      ? parsed.skills.map((s) => String(s).trim()).filter(Boolean)
      : [];

    const searchTerms: string[] = Array.isArray(parsed.searchTerms) && parsed.searchTerms.length > 0
      ? parsed.searchTerms.map((s) => String(s).trim()).filter(Boolean)
      : [
          ...(parsed.headline ? parsed.headline.split(/[,|/•-]/).map((s) => s.trim()) : []),
          ...skills,
          ...experiences.map((e) => e.role),
        ].filter(Boolean);

    return {
      fullName: parsed.fullName?.trim() || null,
      headline: parsed.headline?.trim() || null,
      email: parsed.email?.trim() || null,
      phone: parsed.phone?.trim() || null,
      location,
      skills,
      searchTerms,
      experiences,
      education,
    };
  }
}
