import { Injectable } from '@nestjs/common';
import { SanitizedLogger } from '../logger/sanitized-logger.service';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class OpenRouterAiClient {
  constructor(private readonly logger?: SanitizedLogger) {}

  getApiKey(): string | undefined {
    return (
      process.env.OPENROUTER_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.AI_API_KEY
    );
  }

  getBaseUrl(): string {
    return process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  }

  getModel(): string {
    return (
      process.env.OPENROUTER_MODEL ||
      process.env.AI_MODEL ||
      'google/gemini-2.0-flash-001'
    );
  }

  async generateStructuredJson<T>(
    systemPrompt: string,
    userPrompt: string,
    fallbackValue?: T,
  ): Promise<T> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      if (fallbackValue !== undefined) {
        return fallbackValue;
      }
      throw new Error(
        'AI Provider configuration missing: OPENROUTER_API_KEY is not configured in environment',
      );
    }

    const baseUrl = this.getBaseUrl();
    const model = this.getModel();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://inhire.app',
          'X-Title': 'InHire Intelligent Career Engine',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.0,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`OpenRouter API error (status ${res.status}): ${errorText}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim() || '{}';
      const cleanJson = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      return JSON.parse(cleanJson) as T;
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (this.logger) {
        this.logger.error(
          `OpenRouter AI call failed: ${(err as Error).message}`,
          (err as Error).stack,
          'OpenRouterAiClient',
        );
      }
      if (fallbackValue !== undefined) {
        return fallbackValue;
      }
      throw err;
    }
  }
}
