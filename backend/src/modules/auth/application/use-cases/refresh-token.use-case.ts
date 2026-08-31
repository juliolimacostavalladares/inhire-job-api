import { Injectable, Inject } from '@nestjs/common';
import { USERS_REPOSITORY, UsersRepository } from '../ports/users.repository';
import { SESSIONS_REPOSITORY, SessionsRepository } from '../ports/sessions.repository';
import { TOKEN_SERVICE, TokenService } from '../ports/token-service.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { RefreshSession } from '../../domain/refresh-session.entity';
import { RefreshDto, AuthResultDto } from '../dto/auth.dto';
import { AppError } from '@shared/domain/errors/app-error';

@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepo: UsersRepository,
    @Inject(SESSIONS_REPOSITORY) private readonly sessionsRepo: SessionsRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
  ) {}

  async execute(dto: RefreshDto): Promise<AuthResultDto> {
    if (!dto.refreshToken) {
      throw AppError.unauthenticated('Refresh token required');
    }

    const tokenHash = this.tokenService.hashRefreshToken(dto.refreshToken);
    const session = await this.sessionsRepo.findByTokenHash(tokenHash);

    if (!session) {
      throw AppError.unauthenticated('Invalid refresh session');
    }

    const now = this.clock.now();

    // CAND-AC-02: Reuse of revoked refresh token is detected -> revoke all user sessions
    if (session.revokedAt) {
      await this.sessionsRepo.revokeAllForUser(session.userId, now);
      throw AppError.unauthenticated('Revoked token reuse detected. All sessions invalidated.');
    }

    if (!session.isActive(now)) {
      throw AppError.unauthenticated('Expired refresh session');
    }

    const user = await this.usersRepo.findById(session.userId);
    if (!user) {
      throw AppError.unauthenticated('User not found');
    }

    // Rotate: Revoke the old session
    await this.sessionsRepo.revoke(session.id, now);

    // Create new session
    const newRawRefreshToken = this.tokenService.generateRefreshToken();
    const newTokenHash = this.tokenService.hashRefreshToken(newRawRefreshToken);
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const newSession = RefreshSession.create({
      id: this.idGenerator.generate(),
      userId: user.id,
      tokenHash: newTokenHash,
      expiresAt,
      now,
    });

    await this.sessionsRepo.create(newSession);

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      role: user.role,
      email: user.email,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: 900,
    };
  }
}
