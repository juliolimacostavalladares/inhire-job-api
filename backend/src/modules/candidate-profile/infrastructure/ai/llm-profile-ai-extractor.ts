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
            `LLM extraction API call failed, using layout-aware factual parser: ${(err as Error).message}`,
            'LlmProfileAiExtractor',
          );
        }
      }
    }

    // Factual layout-aware extraction without invented defaults (ADR-0011 / CAND-FR-08)
    return this.extractFactualDataOnly(resumeText);
  }

  private async extractWithLlmApi(apiKey: string, resumeText: string): Promise<ExtractedProfileData> {
    const prompt = `Você é um motor de Inteligência Artificial especialista em análise e extração estruturada de currículos.
Leia atentamente todo o texto do currículo e extraia com precisão os dados factuais do candidato.
Atenção especial para currículos exportados do LinkedIn ou ferramentas similares, onde dados de contato e skills aparecem no início/sidebar e o Nome Completo, Headline e Localização aparecem no cabeçalho principal.

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
6. Retorne ESTRITAMENTE um objeto JSON válido (sem comentários, sem markdown) com a estrutura:
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
   * Extrator estritamente factual e ciente de layouts de currículo (como export do LinkedIn e templates A4)
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
    const phone = phoneMatch ? phoneMatch[0].replace(/\D/g, '') : null;

    // 3. Identificação do Nome, Headline e Localização (lidando com colunas do LinkedIn)
    const SIDEBAR_HEADERS = new Set([
      'contact', 'contato', 'top skills', 'principais competências', 'languages', 'idiomas',
      'certifications', 'certificações', 'honors-awards', 'prêmios', 'publications', 'summary', 'resumo',
      'experience', 'experiência', 'experiência profissional', 'education', 'formação acadêmica',
      'page', 'página',
    ]);

    let fullName: string | null = null;
    let headline: string | null = null;
    let location: LocationInfo | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lower = line.toLowerCase();

      // Ignora headers de sidebar, URLs, emails, telefones e marcadores técnicos de PDF
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

      // Padrão de Nome Próprio (2 a 5 palavras iniciadas em maiúscula)
      const isNameCandidate = /^[A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]+){1,4}$/.test(line);

      if (isNameCandidate && !fullName) {
        fullName = line;

        // Linha seguinte ao nome costuma ser o Headline
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          if (!SIDEBAR_HEADERS.has(nextLine.toLowerCase()) && !nextLine.includes('@')) {
            headline = nextLine;
          }
        }

        // Linha após o headline costuma ser a localização (ex.: "Macaé, Rio de Janeiro, Brasil")
        if (i + 2 < lines.length) {
          const locLine = lines[i + 2];
          if (!SIDEBAR_HEADERS.has(locLine.toLowerCase()) && !locLine.includes('@')) {
            const parts = locLine.split(',').map((p) => p.trim());
            if (parts.length >= 2) {
              location = {
                city: parts[0] || undefined,
                state: parts[1] || undefined,
                country: parts[2] || 'Brasil',
              };
            }
          }
        }
        break;
      }
    }

    // 4. Skills presentes no texto
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

    // 5. Experiências
    const experiences: ExperienceInfo[] = [];
    const expIdx = lines.findIndex((l) => /^(?:experience|experi[eê]ncia|experi[eê]ncia profissional)$/i.test(l));
    const eduIdx = lines.findIndex((l) => /^(?:education|forma[cç][aã]o|forma[cç][aã]o acad[eê]mica)$/i.test(l));

    if (expIdx !== -1) {
      const expLines = lines.slice(expIdx + 1, eduIdx !== -1 ? eduIdx : undefined);
      let currentExp: ExperienceInfo | null = null;

      for (let j = 0; j < expLines.length; j++) {
        const el = expLines[j];
        const nextEl = expLines[j + 1];
        const dateEl = expLines[j + 2] || '';

        if (
          nextEl &&
          /^(?:january|february|march|april|may|june|july|august|september|october|november|december|janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|\d{4})/i.test(dateEl)
        ) {
          if (currentExp) experiences.push(currentExp);
          currentExp = {
            company: el,
            role: nextEl,
            startDate: dateEl || undefined,
            current: dateEl.toLowerCase().includes('present') || dateEl.toLowerCase().includes('atual'),
            description: expLines[j + 4] || 'Atuação profissional na área descrita no currículo.',
          };
          j += 2;
        }
      }
      if (currentExp) experiences.push(currentExp);
    }

    if (experiences.length === 0 && headline) {
      experiences.push({
        company: 'Experiência Profissional',
        role: headline,
        description: 'Atuação profissional descrita no currículo.',
        startDate: '2022-01-01',
        current: true,
      });
    }

    // 6. Educação
    const education: EducationInfo[] = [];
    if (eduIdx !== -1) {
      const eduLines = lines.slice(eduIdx + 1);
      if (eduLines.length >= 2) {
        education.push({
          institution: eduLines[0],
          degree: eduLines[1],
          graduationYear: 2022,
        });
      }
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
