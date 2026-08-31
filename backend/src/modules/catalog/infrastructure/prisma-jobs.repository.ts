import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { JobsRepository, FindJobsFilter } from '../application/ports/jobs.repository';
import { Job, JobStatus, FormFieldSchema } from '../domain/job.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaJobsRepository implements JobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Job | null> {
    const record = await this.prisma.job.findUnique({ where: { id } });
    if (!record) return null;
    return new Job({
      id: record.id,
      tenantId: record.tenantId,
      externalId: record.externalId,
      title: record.title,
      url: record.url,
      status: record.status as JobStatus,
      description: record.description,
      location: record.location,
      formSchema: (record.formSchema as unknown as FormFieldSchema[]) || [],
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async findByTenantAndExternalId(tenantId: string, externalId: string): Promise<Job | null> {
    const record = await this.prisma.job.findUnique({
      where: {
        tenantId_externalId: {
          tenantId,
          externalId,
        },
      },
    });
    if (!record) return null;
    return new Job({
      id: record.id,
      tenantId: record.tenantId,
      externalId: record.externalId,
      title: record.title,
      url: record.url,
      status: record.status as JobStatus,
      description: record.description,
      location: record.location,
      formSchema: (record.formSchema as unknown as FormFieldSchema[]) || [],
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async findAll(filter?: FindJobsFilter): Promise<{ items: Job[]; total: number }> {
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.JobWhereInput = {};
    if (filter?.tenantId) where.tenantId = filter.tenantId;
    if (filter?.status) where.status = filter.status;
    if (filter?.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    const [records, total] = await Promise.all([
      this.prisma.job.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.job.count({ where }),
    ]);

    return {
      items: records.map(
        (r) =>
          new Job({
            id: r.id,
            tenantId: r.tenantId,
            externalId: r.externalId,
            title: r.title,
            url: r.url,
            status: r.status as JobStatus,
            description: r.description,
            location: r.location,
            formSchema: (r.formSchema as unknown as FormFieldSchema[]) || [],
            version: r.version,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          }),
      ),
      total,
    };
  }

  async findByTenantId(tenantId: string): Promise<Job[]> {
    const records = await this.prisma.job.findMany({ where: { tenantId } });
    return records.map(
      (r) =>
        new Job({
          id: r.id,
          tenantId: r.tenantId,
          externalId: r.externalId,
          title: r.title,
          url: r.url,
          status: r.status as JobStatus,
          description: r.description,
          location: r.location,
          formSchema: (r.formSchema as unknown as FormFieldSchema[]) || [],
          version: r.version,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }),
    );
  }

  async save(job: Job): Promise<Job> {
    const record = await this.prisma.job.upsert({
      where: { id: job.id },
      create: {
        id: job.id,
        tenantId: job.tenantId,
        externalId: job.externalId,
        title: job.title,
        url: job.url,
        status: job.status,
        description: job.description,
        location: job.location,
        formSchema: job.formSchema as unknown as Prisma.InputJsonValue,
        version: job.version,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
      update: {
        title: job.title,
        url: job.url,
        status: job.status,
        description: job.description,
        location: job.location,
        formSchema: job.formSchema as unknown as Prisma.InputJsonValue,
        version: job.version,
        updatedAt: job.updatedAt,
      },
    });

    return new Job({
      id: record.id,
      tenantId: record.tenantId,
      externalId: record.externalId,
      title: record.title,
      url: record.url,
      status: record.status as JobStatus,
      description: record.description,
      location: record.location,
      formSchema: (record.formSchema as unknown as FormFieldSchema[]) || [],
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
