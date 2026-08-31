import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { SessionsRepository } from '../application/ports/sessions.repository';
import { RefreshSession } from '../domain/refresh-session.entity';

@Injectable()
export class PrismaSessionsRepository implements SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(session: RefreshSession): Promise<RefreshSession> {
    const record = await this.prisma.refreshSession.create({
      data: {
        id: session.id,
        userId: session.userId,
        tokenHash: session.tokenHash,
        expiresAt: session.expiresAt,
        revokedAt: session.revokedAt,
        createdAt: session.createdAt,
      },
    });
    return new RefreshSession({
      id: record.id,
      userId: record.userId,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      createdAt: record.createdAt,
    });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshSession | null> {
    const record = await this.prisma.refreshSession.findUnique({ where: { tokenHash } });
    if (!record) return null;
    return new RefreshSession({
      id: record.id,
      userId: record.userId,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      createdAt: record.createdAt,
    });
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshSession.update({
      where: { id },
      data: { revokedAt },
    });
  }

  async revokeAllForUser(userId: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt },
    });
  }
}
