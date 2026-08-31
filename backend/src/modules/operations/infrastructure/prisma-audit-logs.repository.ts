import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AuditLogsRepository } from '../application/ports/audit-logs.repository';
import { AuditLog } from '../domain/audit-log.entity';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaAuditLogsRepository implements AuditLogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(log: AuditLog): Promise<AuditLog> {
    const record = await this.prisma.auditLog.create({
      data: {
        id: log.id,
        actorId: log.actorId,
        actorRole: log.actorRole,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        correlationId: log.correlationId,
        details: log.details ? (log.details as Prisma.InputJsonValue) : Prisma.JsonNull,
        createdAt: log.createdAt,
      },
    });

    return new AuditLog({
      id: record.id,
      actorId: record.actorId,
      actorRole: record.actorRole,
      action: record.action,
      targetType: record.targetType,
      targetId: record.targetId,
      correlationId: record.correlationId,
      details: record.details as Record<string, unknown> | null,
      createdAt: record.createdAt,
    });
  }

  async findAll(filter?: { action?: string; targetType?: string; page?: number; limit?: number }): Promise<{ items: AuditLog[]; total: number }> {
    const page = filter?.page ?? 1;
    const limit = filter?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};
    if (filter?.action) where.action = filter.action;
    if (filter?.targetType) where.targetType = filter.targetType;

    const [records, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: records.map(
        (r) =>
          new AuditLog({
            id: r.id,
            actorId: r.actorId,
            actorRole: r.actorRole,
            action: r.action,
            targetType: r.targetType,
            targetId: r.targetId,
            correlationId: r.correlationId,
            details: r.details as Record<string, unknown> | null,
            createdAt: r.createdAt,
          }),
      ),
      total,
    };
  }
}
