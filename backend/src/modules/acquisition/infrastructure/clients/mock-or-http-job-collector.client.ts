import { Injectable } from '@nestjs/common';
import { JobCollectorClient, CollectionResult } from '../../application/ports/job-collector.client';

@Injectable()
export class MockOrHttpJobCollectorClient implements JobCollectorClient {
  async discoverPublicTenants(): Promise<Array<{ slug: string; name: string; officialUrl: string }>> {
    return [
      {
        slug: 'tech-corp',
        name: 'Tech Corp InHire',
        officialUrl: 'https://techcorp.inhire.app/vagas',
      },
      {
        slug: 'fintech-one',
        name: 'FinTech One',
        officialUrl: 'https://fintechone.inhire.app/jobs',
      },
    ];
  }

  async collectFromTenant(officialUrl: string): Promise<CollectionResult> {
    const parsed = new URL(officialUrl);
    const tenantSlug = parsed.hostname.split('.')[0] || 'tenant';

    // Return deterministic jobs for known tenants
    return {
      isConclusive: true,
      jobs: [
        {
          externalId: `ext-${tenantSlug}-01`,
          title: 'Senior Backend Engineer',
          url: `https://${tenantSlug}.inhire.app/jobs/ext-${tenantSlug}-01`,
          description: 'Senior backend developer specializing in Node.js, TypeScript, PostgreSQL, BullMQ and Clean Architecture.',
          location: 'São Paulo, SP, Brazil',
          formSchema: [
            { key: 'fullName', label: 'Nome Completo', type: 'text', required: true },
            { key: 'email', label: 'E-mail', type: 'email', required: true },
            { key: 'phone', label: 'Telefone', type: 'tel', required: true },
            { key: 'resume', label: 'Currículo (PDF)', type: 'file', required: true },
          ],
        },
      ],
    };
  }
}
