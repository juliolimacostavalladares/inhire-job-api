import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AutoApplyDecisionsRepository } from '../application/ports/auto-apply-decisions.repository';
import { AutoApplyDecision, DecisionType } from '../domain/auto-apply-decision.entity';

@Injectable()
export class PrismaAutoApplyDecisionsRepository implements AutoApplyDecisionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countAcceptedForDate(userId: string, evaluationDate: string): Promise<number> {
    return this.prisma.autoApplyDecision.count({
      where: {
        userId,
        evaluationDate,
        decision: 'ACCEPTED',
      },
    });
  }

  async findByUserAndDate(userId: string, evaluationDate: string): Promise<AutoApplyDecision[]> {
    const records = await this.prisma.autoApplyDecision.findMany({
      where: { userId, evaluationDate },
      orderBy: { createdAt: 'desc' },
    });

    return records.map(
      (r) =>
        new AutoApplyDecision({
          id: r.id,
          userId: r.userId,
          jobId: r.jobId,
          decision: r.decision as DecisionType,
          score: r.score,
          reason: r.reason,
          policyVersion: r.policyVersion,
          profileVersion: r.profileVersion,
          jobVersion: r.jobVersion,
          evaluationDate: r.evaluationDate,
          createdAt: r.createdAt,
        }),
    );
  }

  async findByUserAndJob(userId: string, jobId: string): Promise<AutoApplyDecision | null> {
    const record = await this.prisma.autoApplyDecision.findFirst({
      where: { userId, jobId },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return null;

    return new AutoApplyDecision({
      id: record.id,
      userId: record.userId,
      jobId: record.jobId,
      decision: record.decision as DecisionType,
      score: record.score,
      reason: record.reason,
      policyVersion: record.policyVersion,
      profileVersion: record.profileVersion,
      jobVersion: record.jobVersion,
      evaluationDate: record.evaluationDate,
      createdAt: record.createdAt,
    });
  }

  async save(decision: AutoApplyDecision): Promise<AutoApplyDecision> {
    const record = await this.prisma.autoApplyDecision.upsert({
      where: {
        userId_jobId_evaluationDate: {
          userId: decision.userId,
          jobId: decision.jobId,
          evaluationDate: decision.evaluationDate,
        },
      },
      create: {
        id: decision.id,
        userId: decision.userId,
        jobId: decision.jobId,
        decision: decision.decision,
        score: decision.score,
        reason: decision.reason,
        policyVersion: decision.policyVersion,
        profileVersion: decision.profileVersion,
        jobVersion: decision.jobVersion,
        evaluationDate: decision.evaluationDate,
        createdAt: decision.createdAt,
      },
      update: {
        decision: decision.decision,
        score: decision.score,
        reason: decision.reason,
        policyVersion: decision.policyVersion,
        profileVersion: decision.profileVersion,
        jobVersion: decision.jobVersion,
      },
    });

    return new AutoApplyDecision({
      id: record.id,
      userId: record.userId,
      jobId: record.jobId,
      decision: record.decision as DecisionType,
      score: record.score,
      reason: record.reason,
      policyVersion: record.policyVersion,
      profileVersion: record.profileVersion,
      jobVersion: record.jobVersion,
      evaluationDate: record.evaluationDate,
      createdAt: record.createdAt,
    });
  }
}
