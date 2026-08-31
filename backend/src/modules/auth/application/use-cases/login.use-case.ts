import { Injectable, Inject } from '@nestjs/common';
import { USERS_REPOSITORY, UsersRepository } from '../ports/users.repository';
import { SESSIONS_REPOSITORY, SessionsRepository } from '../ports/sessions.repository';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher.port';
import { TOKEN_SERVICE, TokenService } from '../ports/token-service.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { RefreshSession } from '../../domain/refresh-session.entity';
import { LoginDto, AuthResultDto } from '../dto/auth.dto';
import { AppError } from '@shared/domain/errors/app-error';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepo: UsersRepository,
    @Inject(SESSIONS_REPOSITORY) private readonly sessionsRepo: SessionsRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
  ) {}

  async execute(dto: LoginDto): Promise<AuthResultDto> {
    const emailNormalized = dto.email?.trim().toLowerCase();
    if (!emailNormalized || !dto.password) {
      throw AppError.unauthenticated('Invalid email or password');
    }

    const user = await this.usersRepo.findByEmail(emailNormalized);
    if (!user) {
      // CAND-AC-01: Invalid credentials must not reveal if the email exists
      throw AppError.unauthenticated('Invalid email or password');
    }

    const isMatch = await this.passwordHasher.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw AppError.unauthenticated('Invalid email or password');
    }

    const now = this.clock.now();
    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      role: user.role,
      email: user.email,
    });

    const rawRefreshToken = this.tokenService.generateRefreshToken();
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const session = RefreshSession.create({
      id: this.idGenerator.generate(),
      userId: user.id,
      tokenHash,
      expiresAt,
      now,
    });

    await this.sessionsRepo.create(session);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 900,
    };
  }
}
