import { Tenant } from '../../domain/tenant.entity';

export interface TenantsRepository {
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  findAll(filter?: { isActive?: boolean; page?: number; limit?: number }): Promise<{ items: Tenant[]; total: number }>;
  save(tenant: Tenant): Promise<Tenant>;
}

export const TENANTS_REPOSITORY = Symbol('TenantsRepository');
