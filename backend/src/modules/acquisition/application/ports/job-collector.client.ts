import { FormFieldSchema } from '../../../catalog/domain/job.entity';

export interface RawJobPayload {
  externalId: string;
  title: string;
  url: string;
  description: string;
  location?: string;
  workplaceType?: string;
  contractType?: string;
  tags?: string[];
  formSchema: FormFieldSchema[];
}

export interface CollectionResult {
  isConclusive: boolean; // True only if complete listing was parsed without network errors
  jobs: RawJobPayload[];
  error?: string;
}

export interface JobCollectorClient {
  collectFromTenant(officialUrl: string): Promise<CollectionResult>;
  discoverPublicTenants(): Promise<Array<{ slug: string; name: string; officialUrl: string }>>;
}

export const JOB_COLLECTOR_CLIENT = Symbol('JobCollectorClient');
