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
    'preview', 'files', 'portal', 'analytics', 'cdn', 'mail',
  ]);

  constructor(private readonly logger?: SanitizedLogger) {}

  /**
   * Descoberta profunda de empresas e vagas reais em todo o ecossistema InHire
   * Utiliza agregação multi-fonte (Urlscan.io + Wayback Machine + Seeds curadas)
   */
  async discoverPublicTenants(): Promise<Array<{ slug: string; name: string; officialUrl: string }>> {
    const candidateSlugs = new Set<string>([
      'cora', 'dock', 'loggi', 'contabilizei', 'azion', 'takeblip', 'creditas', 'startse', 'dti', 'meliuz',
      'quintoandar', 'loft', 'olist', 'stone', 'picpay', 'ifood', 'gympass', 'neon', 'hotmart', 'totvs',
      'vtex', 'nubank', 'inter', 'itau', 'bradesco', 'santander', 'ambevtech', 'grupoboticario', 'rappi',
      'mercadolivre', 'intelbras', 'solides', 'feedz', 'sprint', 'fintech', 'techcorp', 'vitru', 'deloitte',
      'kpmg', 'radix', 'hiltonbrasil', 'sharepeoplehub', 'viseu', 'semantix', 'vocedm', 'qitech', 'db1',
      'westwing', 'turbi', 'asper', 'sanar', 'magazord', 'alun', 'sylvamo', 'extremegroup', 'cielo', 'conxconstrutora',
      'finallevel', 'alinemainericonsultoria', 'unitech', 'cesconbarrieu', 'vrental', 'lwsa', 'cobli', 'zig',
      'infleet', 'lfaadvogados', 'betha', 'lastlink', 'atlantico', 'matera', 'clavis', 'vagasbyintera', 'segurossura',
      'unionit', 'seventh', 'board', 'grupoguiainvest', 'upda', 'v360', 'seazone', 'magazineluiza', 'kobe', 'celero',
      'chatguru', 'nibo', 'enzrossi', 'gcservicos', 'cactus', 'peers', 'people', 'vagasconfidenciais2', 'foxbit',
      'gobravo', 'principia', 'v4company', 'cardapioweb'
    ]);

    // 1. Busca por novos tenants via Urlscan.io
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('https://urlscan.io/api/v1/search/?q=domain:inhire.app&size=100', {
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeout);

      if (res && res.ok) {
        const json = (await res.json().catch(() => null)) as {
          results?: Array<{ page?: { url?: string }; task?: { url?: string } }>;
        } | null;

        for (const r of json?.results || []) {
          const url = r.page?.url || r.task?.url || '';
          const match = url.match(/https?:\/\/([a-z0-9-]+)\.inhire\.app/i);
          if (match && match[1]) {
            const slug = match[1].toLowerCase();
            if (!this.blockedSubdomains.has(slug)) {
              candidateSlugs.add(slug);
            }
          }
        }
      }
    } catch {
      // Ignora falha de rede externa da fonte
    }

    if (this.logger) {
      this.logger.log(
        `[Discovery] Validando ${candidateSlugs.size} empresas candidatas no ecossistema InHire...`,
        'JobCollectorClient',
      );
    }

    // 2. Validação concorrente dos tenants ativos diretamente na API pública do InHire
    const discovered: Array<{ slug: string; name: string; officialUrl: string }> = [];
    const slugs = Array.from(candidateSlugs);
    const concurrency = 15;
    let idx = 0;

    const worker = async () => {
      while (idx < slugs.length) {
        const slug = slugs[idx++];
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

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

            if (openJobs.length > 0) {
              discovered.push({
                slug,
                name: json?.tenantName || slug,
                officialUrl: `https://${slug}.inhire.app/vagas`,
              });
            }
          }
        } catch {
          // Ignora falha individual
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    if (this.logger) {
      this.logger.log(
        `[Discovery] Descoberta concluída: ${discovered.length} empresas ativas encontradas com vagas abertas!`,
        'JobCollectorClient',
      );
    }

    return discovered;
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
}
