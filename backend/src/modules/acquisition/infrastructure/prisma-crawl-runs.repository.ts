import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CrawlRunsRepository } from '../application/ports/crawl-runs.repository';
import { CrawlRun, RunType, RunTrigger, RunStatus, CrawlItemProps } from '../domain/crawl-run.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaCrawlRunsRepository implements CrawlRunsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<CrawlRun | null> {
    const record = await this.prisma.crawlRun.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!record) return null;

    return new CrawlRun({
      id: record.id,
      type: record.type as RunType,
      trigger: record.trigger as RunTrigger,
      status: record.status as RunStatus,
      totalTenants: record.totalTenants,
      processedTenants: record.processedTenants,
      totalJobsFound: record.totalJobsFound,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      items: record.items.map((it) => ({
        id: it.id,
        runId: it.runId,
        tenantId: it.tenantId,
        status: it.status as 'SUCCEEDED' | 'FAILED',
        jobsCollected: it.jobsCollected,
        errorCode: it.errorCode,
        errorMessage: it.errorMessage,
        createdAt: it.createdAt,
      })),
    });
  }

  async findAll(filter?: { type?: string; status?: string; page?: number; limit?: number }): Promise<{ items: CrawlRun[]; total: number }> {
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.CrawlRunWhereInput = {};
    if (filter?.type) where.type = filter.type;
    if (filter?.status) where.status = filter.status;

    const [records, total] = await Promise.all([
      this.prisma.crawlRun.findMany({ where, skip, take: limit, orderBy: { startedAt: 'desc' } }),
      this.prisma.crawlRun.count({ where }),
    ]);

    return {
      items: records.map(
        (r) =>
          new CrawlRun({
            id: r.id,
            type: r.type as RunType,
            trigger: r.trigger as RunTrigger,
            status: r.status as RunStatus,
            totalTenants: r.totalTenants,
            processedTenants: r.processedTenants,
            totalJobsFound: r.totalJobsFound,
            errorCode: r.errorCode,
            errorMessage: r.errorMessage,
            startedAt: r.startedAt,
            finishedAt: r.finishedAt,
          }),
      ),
      total,
    };
  }

  async save(run: CrawlRun): Promise<CrawlRun> {
    const record = await this.prisma.crawlRun.upsert({
      where: { id: run.id },
      create: {
        id: run.id,
        type: run.type,
        trigger: run.trigger,
        status: run.status,
        totalTenants: run.totalTenants,
        processedTenants: run.processedTenants,
        totalJobsFound: run.totalJobsFound,
        errorCode: run.errorCode,
        errorMessage: run.errorMessage,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
      },
      update: {
        status: run.status,
        processedTenants: run.processedTenants,
        totalJobsFound: run.totalJobsFound,
        errorCode: run.errorCode,
        errorMessage: run.errorMessage,
        finishedAt: run.finishedAt,
      },
    });

    return new CrawlRun({
      id: record.id,
      type: record.type as RunType,
      trigger: record.trigger as RunTrigger,
      status: record.status as RunStatus,
      totalTenants: record.totalTenants,
      processedTenants: record.processedTenants,
      totalJobsFound: record.totalJobsFound,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      items: run.items,
    });
  }

  async addItem(item: CrawlItemProps): Promise<void> {
    await this.prisma.crawlItem.create({
      data: {
        id: item.id,
        runId: item.runId,
        tenantId: item.tenantId,
        status: item.status,
        jobsCollected: item.jobsCollected,
        errorCode: item.errorCode,
        errorMessage: item.errorMessage,
        createdAt: item.createdAt,
      },
    });
  }
}
