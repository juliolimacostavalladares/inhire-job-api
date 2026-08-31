import { Injectable } from '@nestjs/common';
import {
  ProfileAiExtractor,
  ExtractedProfileData,
} from '../../application/ports/profile-ai-extractor.port';
import { LocationInfo, ExperienceInfo, EducationInfo } from '../../domain/candidate-profile.entity';
import { OpenRouterAiClient } from '@shared/infrastructure/ai/openrouter-ai.client';
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
export class OpenRouterProfileAiExtractor implements ProfileAiExtractor {
  constructor(
    private readonly aiClient: OpenRouterAiClient,
    private readonly logger?: SanitizedLogger,
  ) {}

  async extractFromResumeText(resumeText: string): Promise<ExtractedProfileData> {
    const systemPrompt = `Você é um motor de Inteligência Artificial especialista em análise e extração estruturada de currículos profissionais (incluindo perfis do LinkedIn, modelos A4 e currículos acadêmicos).
Analise o texto integral do documento e extraia com precisão rigorosa todas as informações do candidato em formato JSON estruturado.

DIRETRIZES FUNDAMENTAIS (ADR-0011 / CAND-FR-08):
1. NUNCA invente fatos, cargos, cursos, notas ou localidades que não estejam explicitamente no texto.
2. Se um campo não estiver no texto, defina-o como null ou array vazio [].
3. Em perfis do LinkedIn, ignore o bloco de contatos inicial como sendo o nome: identifique o Nome Completo real do candidato no cabeçalho principal do perfil.
4. Extraia todas as tecnologias, ferramentas e linguagens mencionadas no campo skills.
5. Retorne ESTRITAMENTE um objeto JSON válido.`;

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

    // Fallback factual deterministic em caso de ambiente sem rede ou chave ausente
    const fallbackFactual: RawAiProfileResponse = this.extractFactualFallback(resumeText);

    const parsed = await this.aiClient.generateStructuredJson<RawAiProfileResponse>(
      systemPrompt,
      userPrompt,
      fallbackFactual,
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
            graduationYear: ed.graduationYear ? Number(ed.graduationYear) : undefined,
          }))
      : [];

    return {
      fullName: parsed.fullName || null,
      headline: parsed.headline || null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      location,
      skills: Array.isArray(parsed.skills) ? parsed.skills.filter(Boolean) : [],
      experiences,
      education,
    };
  }

  private extractFactualFallback(resumeText: string): RawAiProfileResponse {
    const lines = resumeText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const emailMatch = resumeText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const email = emailMatch ? emailMatch[1].toLowerCase() : null;

    const phoneMatch = resumeText.match(/(?:\+?55\s?)?(?:\(?0?[1-9]{2}\)?\s?)?(?:9[0-9]{4}[-.\s]?[0-9]{4}|[2-8][0-9]{3}[-.\s]?[0-9]{4})/);
    const phone = phoneMatch ? phoneMatch[0].replace(/\D/g, '') : null;

    const SIDEBAR_HEADERS = new Set([
      'contact', 'contato', 'top skills', 'principais competências', 'languages', 'idiomas',
      'certifications', 'certificações', 'honors-awards', 'prêmios', 'publications', 'summary', 'resumo',
      'experience', 'experiência', 'experiência profissional', 'education', 'formação acadêmica',
      'page', 'página',
    ]);

    let fullName: string | null = null;
    let headline: string | null = null;
    let location: { city?: string | null; state?: string | null; country?: string | null } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();

      if (
        SIDEBAR_HEADERS.has(lower) ||
        lower.includes('linkedin.com') ||
        lower.includes('@') ||
        lower.includes('(mobile)') ||
        lower.includes('(telefone)') ||
        /^[\d\s()+-]+$/.test(line) ||
        line.startsWith('%PDF') ||
        line.includes('%%EOF') ||
        /obj|endobj|xref|trailer|startxref/i.test(line) ||
        /curriculum|currículo|resume|cv/i.test(line)
      ) {
        continue;
      }

      if (line.length < 3 || line.length > 50) continue;

      const isNameCandidate = /^[A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]+){1,4}$/.test(line);

      if (isNameCandidate && !fullName) {
        fullName = line;
        if (i + 1 < lines.length && !SIDEBAR_HEADERS.has(lines[i + 1].toLowerCase()) && !lines[i + 1].includes('@')) {
          headline = lines[i + 1];
        }
        if (i + 2 < lines.length && !SIDEBAR_HEADERS.has(lines[i + 2].toLowerCase()) && !lines[i + 2].includes('@')) {
          const parts = lines[i + 2].split(',').map((p) => p.trim());
          if (parts.length >= 2) {
            location = {
              city: parts[0] || null,
              state: parts[1] || null,
              country: parts[2] || 'Brasil',
            };
          }
        }
        break;
      }
    }

    const KNOWN_SKILLS = [
      'TypeScript', 'JavaScript', 'Node.js', 'NestJS', 'React', 'React.js', 'Vue', 'Vue.js', 'Next.js',
      'Python', 'Go', 'Golang', 'Rust', 'Java', 'Spring Boot', 'C#', '.NET',
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS',
      'GCP', 'Azure', 'CI/CD', 'Git', 'Clean Architecture', 'Microservices',
      'GraphQL', 'REST API', 'Figma', 'UI/UX', 'Tailwind', 'Tailwind CSS', 'Linux', 'Terraform',
    ];

    const detectedSkills = KNOWN_SKILLS.filter((skill) => {
      const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return pattern.test(resumeText);
    });

    return {
      fullName,
      headline,
      email,
      phone,
      location,
      skills: detectedSkills,
      experiences: [],
      education: [],
    };
  }
}
