import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { TenantsRepository } from '../application/ports/tenants.repository';
import { Tenant } from '../domain/tenant.entity';

@Injectable()
export class PrismaTenantsRepository implements TenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Tenant | null> {
    const record = await this.prisma.tenant.findUnique({ where: { id } });
    if (!record) return null;
    return new Tenant({
      id: record.id,
      slug: record.slug,
      name: record.name,
      officialUrl: record.officialUrl,
      isActive: record.isActive,
      lastCollectedAt: record.lastCollectedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const record = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!record) return null;
    return new Tenant({
      id: record.id,
      slug: record.slug,
      name: record.name,
      officialUrl: record.officialUrl,
      isActive: record.isActive,
      lastCollectedAt: record.lastCollectedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async findAll(filter?: { isActive?: boolean; page?: number; limit?: number }): Promise<{ items: Tenant[]; total: number }> {
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 50;
    const skip = (page - 1) * limit;
    const where = filter?.isActive !== undefined ? { isActive: filter.isActive } : {};

    const [records, total] = await Promise.all([
      this.prisma.tenant.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      items: records.map(
        (r) =>
          new Tenant({
            id: r.id,
            slug: r.slug,
            name: r.name,
            officialUrl: r.officialUrl,
            isActive: r.isActive,
            lastCollectedAt: r.lastCollectedAt,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          }),
      ),
      total,
    };
  }

  async save(tenant: Tenant): Promise<Tenant> {
    const record = await this.prisma.tenant.upsert({
      where: { id: tenant.id },
      create: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        officialUrl: tenant.officialUrl,
        isActive: tenant.isActive,
        lastCollectedAt: tenant.lastCollectedAt,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
      },
      update: {
        name: tenant.name,
        officialUrl: tenant.officialUrl,
        isActive: tenant.isActive,
        lastCollectedAt: tenant.lastCollectedAt,
        updatedAt: tenant.updatedAt,
      },
    });

    return new Tenant({
      id: record.id,
      slug: record.slug,
      name: record.name,
      officialUrl: record.officialUrl,
      isActive: record.isActive,
      lastCollectedAt: record.lastCollectedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
