import { Injectable } from '@nestjs/common';
import { JobCollectorClient, CollectionResult, RawJobPayload } from '../../application/ports/job-collector.client';
import { SanitizedLogger } from '@shared/infrastructure/logger/sanitized-logger.service';

function slugify(text: string): string {
  return (text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-') || 'vaga';
}

@Injectable()
export class MockOrHttpJobCollectorClient implements JobCollectorClient {
  private readonly blockedSubdomains = new Set([
    'www', 'api', 'auth', 'app', 'status', 'login', 'admin',
    'preview', 'files', 'portal', 'analytics', 'cdn', 'mail', 'inhire', 'demo', 'staging', 'dev',
  ]);

  constructor(private readonly logger?: SanitizedLogger) {}

  /**
   * Descoberta 100% DINÂMICA de empresas na web (sem listas estáticas hardcoded)
   * Agrega fontes em tempo real: Urlscan.io + Wayback Machine CDX + Common Crawl
   */
  async discoverPublicTenants(): Promise<Array<{ slug: string; name: string; officialUrl: string }>> {
    const dynamicSlugs = new Set<string>();

    // 1. Descoberta via UrlScan.io (Páginas recentes do ecossistema *.inhire.app)
    await this.fetchFromUrlscan(dynamicSlugs);

    // 2. Descoberta via Wayback Machine CDX (Arquivo da web)
    await this.fetchFromWayback(dynamicSlugs);

    // 3. Descoberta via Common Crawl Index
    await this.fetchFromCommonCrawl(dynamicSlugs);

    if (this.logger) {
      this.logger.log(
        `[Dynamic Discovery] ${dynamicSlugs.size} empresas únicas encontradas dinamicamente na web. Validando status de vagas abertas...`,
        'JobCollectorClient',
      );
    }

    // 4. Validação concorrente em tempo real na API pública do InHire
    const activeTenants: Array<{ slug: string; name: string; officialUrl: string }> = [];
    const slugs = Array.from(dynamicSlugs);
    const concurrency = 15;
    let idx = 0;

    const worker = async () => {
      while (idx < slugs.length) {
        const slug = slugs[idx++];
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 6000);

          const res = await fetch('https://api.inhire.app/job-posts/public/pages', {
            headers: {
              'X-Tenant': slug,
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
            },
            signal: controller.signal,
          }).catch(() => null);

          clearTimeout(timeout);

          if (res && res.ok) {
            const json = (await res.json().catch(() => null)) as {
              tenantName?: string;
              jobsPage?: Array<{ jobId?: string; status?: string }>;
            } | null;

            const openJobs = json?.jobsPage?.filter(
              (j) => j.jobId && (!j.status || j.status.toLowerCase() === 'published'),
            ) || [];

            // Apenas registra empresas que possuem vagas ativas reais
            if (openJobs.length > 0) {
              activeTenants.push({
                slug,
                name: json?.tenantName || slug,
                officialUrl: `https://${slug}.inhire.app/vagas`,
              });
            }
          }
        } catch {
          // Ignora falhas de conexão em subdomínios inativos
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    if (this.logger) {
      this.logger.log(
        `[Dynamic Discovery] Concluído: ${activeTenants.length} empresas ativas confirmadas com vagas abertas na web!`,
        'JobCollectorClient',
      );
    }

    return activeTenants;
  }

  /**
   * Coleta todas as vagas ativas de um tenant na API pública oficial do InHire
   */
  async collectFromTenant(officialUrl: string): Promise<CollectionResult> {
    const parsed = new URL(officialUrl);
    const tenantSlug = parsed.hostname.split('.')[0] || 'tenant';
    const collectedJobs: RawJobPayload[] = [];
    let isConclusive = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('https://api.inhire.app/job-posts/public/pages', {
        headers: {
          'X-Tenant': tenantSlug,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeout);

      if (res && res.ok) {
        const data = (await res.json().catch(() => null)) as {
          tenantName?: string;
          about?: string;
          jobsPage?: Array<{
            jobId: string;
            displayName: string;
            workplaceType?: string;
            location?: string;
            careerPageId?: string;
            status?: string;
          }>;
        } | null;

        if (data && Array.isArray(data.jobsPage) && data.jobsPage.length > 0) {
          for (const item of data.jobsPage) {
            if (!item.jobId || !item.displayName) continue;
            if (item.status && item.status.toLowerCase() !== 'published') continue;

            const jobSlug = slugify(item.displayName);
            const canonicalUrl = `https://${tenantSlug}.inhire.app/vagas/${item.jobId}/${jobSlug}`;
            const locationStr = item.location
              ? `${item.location} (${item.workplaceType || 'Remoto'})`
              : item.workplaceType || 'Remoto';

            collectedJobs.push({
              externalId: item.jobId,
              title: item.displayName,
              url: canonicalUrl,
              description: `Vaga oficial publicada por ${data.tenantName || tenantSlug} no portal InHire. Modalidade: ${item.workplaceType || 'Não informada'}. Localidade: ${locationStr}.`,
              location: locationStr,
              formSchema: [
                { key: 'fullName', label: 'Nome Completo', type: 'text', required: true },
                { key: 'email', label: 'E-mail', type: 'email', required: true },
                { key: 'phone', label: 'Telefone', type: 'tel', required: true },
                { key: 'city', label: 'Cidade', type: 'text', required: false },
                { key: 'country', label: 'País', type: 'text', required: false },
                { key: 'resume', label: 'Currículo (PDF)', type: 'file', required: true },
              ],
            });
          }
          isConclusive = true;
        }
      }
    } catch (err: unknown) {
      if (this.logger) {
        this.logger.error(
          `Error querying InHire official API for tenant ${tenantSlug}: ${(err as Error).message}`,
          (err as Error).stack,
          'JobCollectorClient',
        );
      }
    }

    return {
      isConclusive: isConclusive || collectedJobs.length > 0,
      jobs: collectedJobs,
    };
  }

  private async fetchFromUrlscan(slugs: Set<string>): Promise<void> {
    let endpoint = 'https://urlscan.io/api/v1/search/?q=domain:inhire.app&size=100';
    for (let page = 0; page < 5 && endpoint; page++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(endpoint, { signal: controller.signal }).catch(() => null);
        clearTimeout(timeout);

        if (!res || !res.ok) break;

        const json = (await res.json().catch(() => null)) as {
          results?: Array<{ page?: { url?: string }; task?: { url?: string }; sort?: Array<string | number> }>;
          has_more?: boolean;
        } | null;

        const results = json?.results || [];
        for (const r of results) {
          const url = r.page?.url || r.task?.url || '';
          this.extractSlug(url, slugs);
        }

        const lastSort = results[results.length - 1]?.sort?.[0];
        endpoint = (json?.has_more && lastSort)
          ? `https://urlscan.io/api/v1/search/?q=domain:inhire.app&size=100&search_after=${encodeURIComponent(String(lastSort))}`
          : '';
      } catch {
        break;
      }
    }
  }

  private async fetchFromWayback(slugs: Set<string>): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch('https://web.archive.org/cdx/search/cdx?url=*.inhire.app/*&output=text&fl=original&collapse=urlkey&limit=20000', {
        headers: { 'User-Agent': 'InHire-Dynamic-Discovery-Crawler/2.0' },
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeout);

      if (res && res.ok) {
        const text = await res.text();
        const matches = text.match(/https?:\/\/([a-z0-9-]+)\.inhire\.app/gi) || [];
        for (const m of matches) {
          this.extractSlug(m, slugs);
        }
      }
    } catch {
      // Falhas da API externa são absorvidas
    }
  }

  private async fetchFromCommonCrawl(slugs: Set<string>): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const infoRes = await fetch('https://index.commoncrawl.org/collinfo.json', { signal: controller.signal }).catch(() => null);
      clearTimeout(timeout);

      if (infoRes && infoRes.ok) {
        const indexes = ((await infoRes.json().catch(() => [])) as Array<{ id: string }>).slice(0, 3);
        for (const idx of indexes) {
          try {
            const ccController = new AbortController();
            const ccTimeout = setTimeout(() => ccController.abort(), 10000);
            const ccRes = await fetch(`https://index.commoncrawl.org/${encodeURIComponent(idx.id)}-index?url=*.inhire.app/*&output=json&fl=url`, {
              signal: ccController.signal,
            }).catch(() => null);
            clearTimeout(ccTimeout);

            if (ccRes && ccRes.ok) {
              const ccText = await ccRes.text();
              for (const line of ccText.split('\n')) {
                if (!line.trim()) continue;
                try {
                  const parsed = JSON.parse(line) as { url?: string };
                  if (parsed.url) {
                    this.extractSlug(parsed.url, slugs);
                  }
                } catch {}
              }
            }
          } catch {}
        }
      }
    } catch {}
  }

  private extractSlug(url: string, slugs: Set<string>): void {
    const match = url.match(/https?:\/\/([a-z0-9-]+)\.inhire\.app/i);
    if (match && match[1]) {
      const slug = match[1].toLowerCase().trim();
      if (!this.blockedSubdomains.has(slug) && slug.length >= 2) {
        slugs.add(slug);
      }
    }
  }
}
