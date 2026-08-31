import { Injectable, Inject } from '@nestjs/common';
import { USERS_REPOSITORY, UsersRepository } from '../ports/users.repository';
import { SESSIONS_REPOSITORY, SessionsRepository } from '../ports/sessions.repository';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher.port';
import { TOKEN_SERVICE, TokenService } from '../ports/token-service.port';
import { CLOCK_PORT, Clock } from '@shared/domain/ports/clock.port';
import { ID_GENERATOR_PORT, IdGenerator } from '@shared/domain/ports/id-generator.port';
import { User } from '../../domain/user.entity';
import { RefreshSession } from '../../domain/refresh-session.entity';
import { RegisterDto, AuthResultDto } from '../dto/auth.dto';
import { AppError } from '@shared/domain/errors/app-error';

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepo: UsersRepository,
    @Inject(SESSIONS_REPOSITORY) private readonly sessionsRepo: SessionsRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokenService: TokenService,
    @Inject(CLOCK_PORT) private readonly clock: Clock,
    @Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGenerator,
  ) {}

  async execute(dto: RegisterDto): Promise<AuthResultDto> {
    const emailNormalized = dto.email?.trim().toLowerCase();
    if (!emailNormalized || !dto.password) {
      throw AppError.validationFailed('Email and password are required');
    }

    const existing = await this.usersRepo.findByEmail(emailNormalized);
    if (existing) {
      throw AppError.validationFailed('User already exists');
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);
    const userId = this.idGenerator.generate();
    const now = this.clock.now();

    const user = User.create({
      id: userId,
      email: emailNormalized,
      passwordHash,
      role: dto.role ?? 'CANDIDATE',
      now,
    });

    await this.usersRepo.create(user);

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      role: user.role,
      email: user.email,
    });

    const rawRefreshToken = this.tokenService.generateRefreshToken();
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

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
      expiresIn: 900, // 15 mins in seconds
    };
  }
}
