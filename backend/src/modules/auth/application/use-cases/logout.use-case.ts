import { Injectable, Inject } from '@nestjs/common';
import { SESSIONS_REPOSITORY, SessionsRepository } from '../ports/sessions.repository';
import { TOKEN_SERVICE, TokenService } from '../ports/token-service.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { LogoutDto } from '../dto/auth.dto';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(SESSIONS_REPOSITORY) private readonly sessionsRepo: SessionsRepository,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
  ) {}

  async execute(dto: LogoutDto): Promise<void> {
    if (!dto.refreshToken) return;
    const tokenHash = this.tokenService.hashRefreshToken(dto.refreshToken);
    const session = await this.sessionsRepo.findByTokenHash(tokenHash);
    if (session && session.isActive(this.clock.now())) {
      await this.sessionsRepo.revoke(session.id, this.clock.now());
    }
  }
}
