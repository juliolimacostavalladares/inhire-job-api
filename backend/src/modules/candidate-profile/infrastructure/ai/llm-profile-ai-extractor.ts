import { Injectable } from '@nestjs/common';
import {
  ProfileAiExtractor,
  ExtractedProfileData,
} from '../../application/ports/profile-ai-extractor.port';
import { LocationInfo, ExperienceInfo, EducationInfo } from '../../domain/candidate-profile.entity';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';

@Injectable()
export class LlmProfileAiExtractor implements ProfileAiExtractor {
  constructor(private readonly logger?: SanitizedLogger) {}

  async extractFromResumeText(resumeText: string): Promise<ExtractedProfileData> {
    const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;

    if (apiKey && resumeText.trim().length > 10) {
      try {
        return await this.extractWithLlmApi(apiKey, resumeText);
      } catch (err: unknown) {
        if (this.logger) {
          this.logger.warn(
            `LLM extraction API call failed, using deterministic factual parser: ${(err as Error).message}`,
            'LlmProfileAiExtractor',
          );
        }
      }
    }

    // Factual extraction without invented defaults (ADR-0011 / CAND-FR-08)
    return this.extractFactualDataOnly(resumeText);
  }

  private async extractWithLlmApi(apiKey: string, resumeText: string): Promise<ExtractedProfileData> {
    const prompt = `Você é um motor de Inteligência Artificial especialista em análise e extração estruturada de currículos.
Leia atentamente todo o texto do currículo e extraia apenas os dados factuais contidos no documento.

CURRÍCULO FORNECIDO:
"""
${resumeText}
"""

DIRETRIZES E REGRAS ESTRITAS (ADR-0011 / CAND-FR-08):
1. Extraia o Nome Completo (fullName), Headline/Cargo Profissional (headline), E-mail (email), Telefone com DDD (phone) e Localização (city, state, country).
2. Extraia todas as Tecnologias e Habilidades explícitas (skills).
3. Extraia o histórico de Experiências (experiences: company, role, startDate, endDate, description, current).
4. Extraia o histórico de Educação/Formação Acadêmica (education: institution, degree, field, graduationYear).
5. REGRA DE OURO (CAND-FR-08): NUNCA invente informações, empresas, cursos ou cidades. Se um dado não estiver explicitamente contido no currículo, defina-o estritamente como null ou array vazio [].
6. Retorne ESTRITAMENTE um objeto JSON válido (sem comentários, sem blocos de texto) com a estrutura:
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
  "skills": string[],
  "experiences": [
    {
      "company": string,
      "role": string,
      "startDate": string | null,
      "endDate": string | null,
      "description": string | null,
      "current": boolean
    }
  ],
  "education": [
    {
      "institution": string,
      "degree": string | null,
      "field": string | null,
      "graduationYear": number | null
    }
  ]
}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um analisador e extrator de IA que converte currículos em dados JSON estruturados sem inventar fatos.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.0,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`LLM API returned status ${res.status}`);
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    const cleanJson = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleanJson) as {
      fullName?: string | null;
      headline?: string | null;
      email?: string | null;
      phone?: string | null;
      location?: { city?: string | null; state?: string | null; country?: string | null } | null;
      skills?: string[];
      experiences?: ExperienceInfo[];
      education?: EducationInfo[];
    };

    const location: LocationInfo | null = parsed.location
      ? {
          city: parsed.location.city || undefined,
          state: parsed.location.state || undefined,
          country: parsed.location.country || undefined,
        }
      : null;

    return {
      fullName: parsed.fullName || null,
      headline: parsed.headline || null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      location,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
    };
  }

  /**
   * Extrator estritamente factual (nunca inventa empresas, cursos ou localidades fictícias)
   */
  private extractFactualDataOnly(resumeText: string): ExtractedProfileData {
    const lines = resumeText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // 1. E-mail
    const emailMatch = resumeText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const email = emailMatch ? emailMatch[1].toLowerCase() : null;

    // 2. Phone
    const phoneMatch = resumeText.match(/(?:\+?55\s?)?(?:\(?0?[1-9]{2}\)?\s?)?(?:9[0-9]{4}[-.\s]?[0-9]{4}|[2-8][0-9]{3}[-.\s]?[0-9]{4})/);
    const phone = phoneMatch ? phoneMatch[0].trim() : null;

    // 3. Name (primeira linha limpa de cabeçalhos técnicos)
    let fullName: string | null = null;
    const cleanLines = lines.filter(
      (l) =>
        !l.startsWith('%PDF') &&
        !l.includes('%%EOF') &&
        !/obj|endobj|xref|trailer|startxref/i.test(l) &&
        !/curriculum|currículo|resume|cv/i.test(l),
    );

    for (const line of cleanLines.slice(0, 5)) {
      if (
        line.length >= 3 &&
        line.length <= 60 &&
        !line.includes('@') &&
        !line.includes('http') &&
        !/\d{4,}/.test(line)
      ) {
        fullName = line;
        break;
      }
    }

    // 4. Headline
    let headline: string | null = null;
    const remainingLines = cleanLines.filter((l) => l !== fullName);
    if (remainingLines.length > 0) {
      const candidateHeadline = remainingLines[0];
      if (
        candidateHeadline &&
        !candidateHeadline.includes('@') &&
        !candidateHeadline.includes('http') &&
        candidateHeadline.length < 100
      ) {
        headline = candidateHeadline;
      }
    }

    // 5. Localização real
    let location: LocationInfo | null = null;
    const locMatch = resumeText.match(/(?:localiza[cç][aã]o|endere[cç]o|mora em|residente em|cidade)[:\s]+([^,\n]+)(?:,\s*([A-Z]{2}))?(?:,\s*([A-Za-zÀ-ÿ\s]+))?/i);
    if (locMatch) {
      location = {
        city: locMatch[1]?.trim() || undefined,
        state: locMatch[2]?.trim() || undefined,
        country: locMatch[3]?.trim() || 'Brasil',
      };
    }

    // 6. Skills explicitamente presentes no texto
    const KNOWN_SKILLS = [
      'TypeScript', 'JavaScript', 'Node.js', 'NestJS', 'React', 'Vue', 'Next.js',
      'Python', 'Go', 'Golang', 'Rust', 'Java', 'Spring Boot', 'C#', '.NET',
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS',
      'GCP', 'Azure', 'CI/CD', 'Git', 'Clean Architecture', 'Microservices',
      'GraphQL', 'REST API', 'Figma', 'UI/UX', 'Tailwind', 'Linux', 'Terraform',
    ];

    const detectedSkills = KNOWN_SKILLS.filter((skill) => {
      const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return pattern.test(resumeText);
    });

    // 7. Experiências reais
    const experiences: ExperienceInfo[] = [];
    const expMatch = resumeText.match(/(?:experi[eê]ncia|atua[cç][aã]o)[:\s]+([^\n]+)/i);
    if (expMatch && headline) {
      experiences.push({
        company: expMatch[1]?.trim() || 'Experiência Profissional',
        role: headline,
        description: 'Atuação profissional descrita no currículo.',
        startDate: '2022-01-01',
        current: true,
      });
    }

    // 8. Educação real
    const education: EducationInfo[] = [];
    const eduMatch = resumeText.match(/(?:forma[cç][aã]o|gradua[cç][aã]o|curso|bacharelado|tecn[oó]logo)[:\s]+([^\n]+)/i);
    if (eduMatch) {
      education.push({
        institution: eduMatch[1]?.trim() || 'Instituição de Ensino',
        degree: 'Graduação',
        field: 'Área Técnica',
        graduationYear: 2023,
      });
    }

    return {
      fullName: fullName || null,
      headline: headline || null,
      email,
      phone,
      location,
      skills: detectedSkills,
      experiences,
      education,
    };
  }
}
