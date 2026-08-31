import { Injectable } from '@nestjs/common';
import { SanitizedLogger } from '../logger/sanitized-logger.service';

@Injectable()
export class NineRouterAiClient {
  constructor(private readonly logger?: SanitizedLogger) {}

  getBaseUrl(): string {
    let url = (
      process.env.NINEROUTER_URL ||
      process.env.AI_BASE_URL ||
      'http://localhost:20128'
    ).trim().replace(/\/+$/, '');

    // Se o usuário passou /v1 no final da URL, normalizar para evitar /v1/v1
    if (url.endsWith('/v1')) {
      url = url.slice(0, -3);
    }
    return url;
  }

  getApiKey(): string | undefined {
    const key = (
      process.env.NINEROUTER_KEY ||
      process.env.NINEROUTER_API_KEY ||
      process.env.AI_API_KEY
    )?.trim();
    return key || undefined;
  }

  getModel(): string {
    const model = (
      process.env.NINEROUTER_MODEL ||
      process.env.AI_MODEL ||
      'bzl/gemini-3.1-flash-lite-preview'
    ).trim();
    return model;
  }

  async generateStructuredJson<T>(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<T> {
    const baseUrl = this.getBaseUrl();
    const apiKey = this.getApiKey();
    const model = this.getModel();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    if (this.logger) {
      this.logger.log(
        {
          message: `[9Router] Calling AI Gateway: endpoint=${baseUrl}/v1/chat/completions, model=${model}, hasAuth=${Boolean(apiKey)}`,
        },
        'NineRouterAiClient',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.0,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`9Router API error (status ${res.status}): ${errorText}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };

      if (data.error) {
        throw new Error(`9Router Error: ${data.error.message || 'Unknown error'}`);
      }

      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('9Router returned empty content in AI response');
      }

      const cleanJson = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      return JSON.parse(cleanJson) as T;
    } catch (err: unknown) {
      clearTimeout(timeout);
      if (this.logger) {
        this.logger.error(
          `9Router AI execution failed: ${(err as Error).message}`,
          (err as Error).stack,
          'NineRouterAiClient',
        );
      }
      throw err;
    }
  }
}
