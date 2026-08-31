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

const TECH_INCLUDE_PATTERNS = [
  /\bsoftware\b/i,
  /\bbackend\b/i,
  /\bback-end\b/i,
  /\bback end\b/i,
  /\bengineer\b/i,
  /\bengenheir[oa]\b/i,
  /\bdesenvolvedor[a]?\b/i,
  /\bdeveloper\b/i,
  /\bfullstack\b/i,
  /\bfull-stack\b/i,
  /\bfull stack\b/i,
  /\bfrontend\b/i,
  /\bfront-end\b/i,
  /\btech lead\b/i,
  /\blead engineer\b/i,
  /\barquitet[oa]\b/i,
  /\barchitect\b/i,
  /\bnode\b/i,
  /\btypescript\b/i,
  /\bgolang\b/i,
  /\bgo\b/i,
  /\bpython\b/i,
  /\brust\b/i,
  /\bjava\b/i,
  /\bsre\b/i,
  /\bdevops\b/i,
  /\bcloud\b/i,
  /\binfraestrutura\b/i,
  /\binfrastructure\b/i,
  /\bdata engineer\b/i,
  /\bengenheir[oa] de dados\b/i,
  /\bsolutions engineer\b/i,
  /\btech manager\b/i,
  /\bengineering manager\b/i,
  /\bqa engineer\b/i,
  /\bsdet\b/i,
];

const NON_TECH_EXCLUDE_PATTERNS = [
  /\balmoxarifad[oa]\b/i,
  /\bauxiliar de log[ií]stica\b/i,
  /\baprendiz\b/i,
  /\bmotorista\b/i,
  /\bestoque\b/i,
  /\blimpeza\b/i,
  /\brecep[cç][aã]o\b/i,
  /\brecepcionista\b/i,
  /\batendente\b/i,
  /\bbdr\b/i,
  /\bvendas\b/i,
  /\bs&op\b/i,
  /\bpreven[cç][aã]o a perdas\b/i,
  /\bcomunica[cç][aã]o interna\b/i,
  /\baccount manager\b/i,
  /\baccount management\b/i,
  /\bbusiness development\b/i,
  /\bassistente log[ií]stica\b/i,
  /\bvendedor[a]?\b/i,
  /\bpromotor[a]?\b/i,
  /\bvp of sales\b/i,
];

function isJobInProfessionalNiche(title: string, description = ''): boolean {
  const text = `${title} ${description}`.toLowerCase();

  // 1. Excluir explicitamente cargos não-técnicos
  for (const excludePattern of NON_TECH_EXCLUDE_PATTERNS) {
    if (excludePattern.test(title)) {
      return false;
    }
  }

  // 2. Incluir se houver correspondência com termos de engenharia e tecnologia
  for (const includePattern of TECH_INCLUDE_PATTERNS) {
    if (includePattern.test(text)) {
      return true;
    }
  }

  return false;
}

@Injectable()
export class MockOrHttpJobCollectorClient implements JobCollectorClient {
  constructor(private readonly logger?: SanitizedLogger) {}

  /**
   * Descobre tenants reais ativos com páginas de carreira na plataforma InHire
   */
  async discoverPublicTenants(): Promise<Array<{ slug: string; name: string; officialUrl: string }>> {
    const candidateSlugs = [
      'cora',
      'dock',
      'loggi',
      'contabilizei',
      'azion',
      'takeblip',
      'creditas',
      'startse',
      'dti',
    ];

    const discovered: Array<{ slug: string; name: string; officialUrl: string }> = [];

    for (const slug of candidateSlugs) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        const res = await fetch('https://api.inhire.app/job-posts/public/pages', {
          headers: {
            'X-Tenant': slug,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
          },
          signal: controller.signal,
        }).catch(() => null);

        clearTimeout(timeout);

        if (res && res.ok) {
          const json = (await res.json().catch(() => null)) as { tenantName?: string; jobsPage?: unknown[] } | null;
          if (json && json.tenantName) {
            discovered.push({
              slug,
              name: json.tenantName,
              officialUrl: `https://${slug}.inhire.app/vagas`,
            });
          }
        }
      } catch (err: unknown) {
        if (this.logger) {
          this.logger.warn(`Failed probing InHire tenant ${slug}: ${(err as Error).message}`, 'JobCollectorClient');
        }
      }
    }

    if (discovered.length === 0) {
      return [
        { slug: 'cora', name: 'Cora', officialUrl: 'https://cora.inhire.app/vagas' },
        { slug: 'dock', name: 'Dock', officialUrl: 'https://dock.inhire.app/vagas' },
        { slug: 'loggi', name: 'Loggi', officialUrl: 'https://loggi.inhire.app/vagas' },
        { slug: 'contabilizei', name: 'Contabilizei', officialUrl: 'https://contabilizei.inhire.app/vagas' },
        { slug: 'azion', name: 'azion', officialUrl: 'https://azion.inhire.app/vagas' },
      ];
    }

    return discovered;
  }

  /**
   * Coleta vagas reais da API pública oficial do InHire, aplicando filtro estrito de nicho de Engenharia de Software / Backend
   */
  async collectFromTenant(officialUrl: string): Promise<CollectionResult> {
    const parsed = new URL(officialUrl);
    const tenantSlug = parsed.hostname.split('.')[0] || 'tenant';
    const collectedJobs: RawJobPayload[] = [];
    let isConclusive = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

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
          }>;
        } | null;

        if (data && Array.isArray(data.jobsPage) && data.jobsPage.length > 0) {
          for (const item of data.jobsPage) {
            if (!item.jobId || !item.displayName) continue;

            // Filtragem estrita de nicho (Engenharia de Software / Backend / Tech)
            if (!isJobInProfessionalNiche(item.displayName)) {
              continue;
            }

            const jobSlug = slugify(item.displayName);
            const canonicalUrl = `https://${tenantSlug}.inhire.app/vagas/${item.jobId}/${jobSlug}`;
            const locationStr = item.location ? `${item.location} (${item.workplaceType || 'Remoto'})` : (item.workplaceType || 'Remoto');

            collectedJobs.push({
              externalId: item.jobId,
              title: item.displayName,
              url: canonicalUrl,
              description: `Oportunidade especializada de tecnologia na ${data.tenantName || tenantSlug}. Foco técnico em desenvolvimento de software, arquitetura e engenharia. Modalidade: ${item.workplaceType || 'Não informada'}. Localidade: ${locationStr}.`,
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
        this.logger.error(`Error querying InHire official API for tenant ${tenantSlug}: ${(err as Error).message}`, (err as Error).stack, 'JobCollectorClient');
      }
    }

    return {
      isConclusive: isConclusive || collectedJobs.length > 0,
      jobs: collectedJobs,
    };
  }
}
