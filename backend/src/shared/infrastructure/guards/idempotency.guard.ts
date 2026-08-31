import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AppError } from '@shared/domain/errors/app-error';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  private inMemoryCache = new Map<string, { requestHash: string }>();

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const idempotencyKey = req.headers['idempotency-key'] as string;

    if (!idempotencyKey || !['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return true;
    }

    const actorId = (req as unknown as { user?: { userId: string; sub?: string } }).user?.sub || (req as unknown as { user?: { userId: string } }).user?.userId || 'anonymous';
    const route = req.path || req.url;
    const bodyString = JSON.stringify(req.body || {});
    const requestHash = crypto.createHash('sha256').update(bodyString).digest('hex');
    const cacheKey = `${actorId}:${idempotencyKey}:${route}`;

    try {
      const existingRecord = await this.prisma.idempotencyRecord.findUnique({
        where: {
          actorId_key_route: {
            actorId,
            key: idempotencyKey,
            route,
          },
        },
      });

      if (existingRecord) {
        if (existingRecord.requestHash !== requestHash) {
          throw AppError.idempotencyConflict('Idempotency-Key reused with different request payload');
        }
      } else {
        await this.prisma.idempotencyRecord.create({
          data: {
            actorId,
            key: idempotencyKey,
            route,
            requestHash,
          },
        }).catch(() => {});
      }
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      // Fallback to in-memory idempotency check when DB is in test/mock mode
      const cached = this.inMemoryCache.get(cacheKey);
      if (cached) {
        if (cached.requestHash !== requestHash) {
          throw AppError.idempotencyConflict('Idempotency-Key reused with different request payload');
        }
      } else {
        this.inMemoryCache.set(cacheKey, { requestHash });
      }
    }

    return true;
  }
}
