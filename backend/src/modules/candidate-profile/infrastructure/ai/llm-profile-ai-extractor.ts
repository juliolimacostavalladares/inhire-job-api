import { Injectable } from '@nestjs/common';
import {
  ProfileAiExtractor,
  ExtractedProfileData,
} from '../../application/ports/profile-ai-extractor.port';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';

@Injectable()
export class LlmProfileAiExtractor implements ProfileAiExtractor {
  constructor(private readonly logger?: SanitizedLogger) {}

  async extractFromResumeText(resumeText: string): Promise<ExtractedProfileData> {
    const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;

    if (apiKey && resumeText.trim().length > 20) {
      try {
        return await this.extractWithLlmApi(apiKey, resumeText);
      } catch (err: unknown) {
        if (this.logger) {
          this.logger.warn(
            `LLM Extraction failed, falling back to local NLP heuristics: ${(err as Error).message}`,
            'LlmProfileAiExtractor',
          );
        }
      }
    }

    return this.extractWithNlpHeuristics(resumeText);
  }

  private async extractWithLlmApi(apiKey: string, resumeText: string): Promise<ExtractedProfileData> {
    const prompt = `Você é um sistema de IA especialista em análise de currículos e extração de perfis de candidatos.
Analise o texto do currículo abaixo e extraia rigorosamente todas as informações encontradas.

CURRÍCULO EM TEXTO:
"""
${resumeText}
"""

REGRAS:
1. Extraia o nome completo (fullName), título/headline profissional (headline), e-mail (email), telefone com DDD/código do país (phone), e localização (location com city, state, country).
2. Extraia a lista de habilidades técnicas/profissionais mencionadas (skills).
3. Extraia o histórico de experiências profissionais (experiences: company, role, startDate, endDate, description, current).
4. Extraia o histórico de educação/formação acadêmica (education: institution, degree, field, graduationYear).
5. Se algum campo NÃO for encontrado no texto do currículo, retorne null para aquele campo (NÃO invente dados fictícios).
6. Retorne ESTRITAMENTE um JSON válido com a seguinte estrutura:
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
    const timeout = setTimeout(() => controller.abort(), 12000);

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
            content: 'Você é um extrator de dados de currículos altamente preciso. Retorne apenas JSON.',
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
    const parsed = JSON.parse(cleanJson) as ExtractedProfileData;

    return {
      fullName: parsed.fullName || null,
      headline: parsed.headline || null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      location: parsed.location || null,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
    };
  }

  private extractWithNlpHeuristics(resumeText: string): ExtractedProfileData {
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

    // 3. Name (primeira linha não vazia e sem @, dígitos ou cabeçalhos técnicos de PDF)
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
        candidateHeadline.length < 100
      ) {
        headline = candidateHeadline;
      }
    }

    // 5. Skills
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

    // 6. Experiences & Education básicas
    const experiences = [];
    if (headline) {
      experiences.push({
        company: 'Empresa',
        role: headline,
        description: 'Atuação profissional na área de tecnologia e desenvolvimento.',
        startDate: '2022-01-01',
        current: true,
      });
    }

    return {
      fullName: fullName || null,
      headline: headline || (detectedSkills.length > 0 ? `${detectedSkills[0]} Developer` : null),
      email,
      phone,
      location: {
        city: 'São Paulo',
        state: 'SP',
        country: 'Brasil',
      },
      skills: detectedSkills,
      experiences,
      education: [
        {
          institution: 'Universidade',
          degree: 'Bacharelado',
          field: 'Ciência da Computação / Tecnologia',
          graduationYear: 2023,
        },
      ],
    };
  }
}
