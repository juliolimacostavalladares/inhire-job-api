import { RefreshSession } from '../../domain/refresh-session.entity';

export interface SessionsRepository {
  create(session: RefreshSession): Promise<RefreshSession>;
  findByTokenHash(tokenHash: string): Promise<RefreshSession | null>;
  revoke(id: string, revokedAt: Date): Promise<void>;
  revokeAllForUser(userId: string, revokedAt: Date): Promise<void>;
}

export const SESSIONS_REPOSITORY = Symbol('SessionsRepository');
