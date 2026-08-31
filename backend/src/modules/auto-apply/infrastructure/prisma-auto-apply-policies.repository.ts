import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AutoApplyPoliciesRepository } from '../application/ports/auto-apply-policies.repository';
import { AutoApplyPolicy } from '../domain/auto-apply-policy.entity';

@Injectable()
export class PrismaAutoApplyPoliciesRepository implements AutoApplyPoliciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<AutoApplyPolicy | null> {
    const record = await this.prisma.autoApplyPolicy.findUnique({ where: { userId } });
    if (!record) return null;
    return new AutoApplyPolicy({
      id: record.id,
      userId: record.userId,
      enabled: record.enabled,
      minScore: record.minScore,
      dailyLimit: record.dailyLimit,
      timezone: record.timezone,
      targetRoles: record.targetRoles,
      targetLocations: record.targetLocations,
      version: record.version,
      updatedAt: record.updatedAt,
    });
  }

  async save(policy: AutoApplyPolicy): Promise<AutoApplyPolicy> {
    const record = await this.prisma.autoApplyPolicy.upsert({
      where: { userId: policy.userId },
      create: {
        id: policy.id,
        userId: policy.userId,
        enabled: policy.enabled,
        minScore: policy.minScore,
        dailyLimit: policy.dailyLimit,
        timezone: policy.timezone,
        targetRoles: policy.targetRoles,
        targetLocations: policy.targetLocations,
        version: policy.version,
        updatedAt: policy.updatedAt,
      },
      update: {
        enabled: policy.enabled,
        minScore: policy.minScore,
        dailyLimit: policy.dailyLimit,
        timezone: policy.timezone,
        targetRoles: policy.targetRoles,
        targetLocations: policy.targetLocations,
        version: policy.version,
        updatedAt: policy.updatedAt,
      },
    });

    return new AutoApplyPolicy({
      id: record.id,
      userId: record.userId,
      enabled: record.enabled,
      minScore: record.minScore,
      dailyLimit: record.dailyLimit,
      timezone: record.timezone,
      targetRoles: record.targetRoles,
      targetLocations: record.targetLocations,
      version: record.version,
      updatedAt: record.updatedAt,
    });
  }
}
