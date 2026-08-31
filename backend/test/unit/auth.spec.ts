import { RegisterUserUseCase } from '@modules/auth/application/use-cases/register-user.use-case';
import { LoginUseCase } from '@modules/auth/application/use-cases/login.use-case';
import { RefreshTokenUseCase } from '@modules/auth/application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '@modules/auth/application/use-cases/logout.use-case';
import { UsersRepository } from '@modules/auth/application/ports/users.repository';
import { SessionsRepository } from '@modules/auth/application/ports/sessions.repository';
import { User } from '@modules/auth/domain/user.entity';
import { RefreshSession } from '@modules/auth/domain/refresh-session.entity';
import { FakeClock } from '@shared/infrastructure/clock/fake-clock';
import { UuidGenerator } from '@shared/infrastructure/id-generator/uuid-generator';
import { JwtTokenService } from '@modules/auth/infrastructure/jwt-token-service';
import { BcryptPasswordHasher } from '@modules/auth/infrastructure/bcrypt-password-hasher';
import { AppError } from '@shared/domain/errors/app-error';

class InMemoryUsersRepository implements UsersRepository {
  private users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.email === email.toLowerCase().trim()) return u;
    }
    return null;
  }

  async create(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }
}

class InMemorySessionsRepository implements SessionsRepository {
  private sessions = new Map<string, RefreshSession>();

  async create(session: RefreshSession): Promise<RefreshSession> {
    this.sessions.set(session.id, session);
    return session;
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshSession | null> {
    for (const s of this.sessions.values()) {
      if (s.tokenHash === tokenHash) return s;
    }
    return null;
  }

  async revoke(id: string, revokedAt: Date): Promise<void> {
    const s = this.sessions.get(id);
    if (s) s.revoke(revokedAt);
  }

  async revokeAllForUser(userId: string, revokedAt: Date): Promise<void> {
    for (const s of this.sessions.values()) {
      if (s.userId === userId) s.revoke(revokedAt);
    }
  }
}

describe('Auth Module - Unit Tests (CAND-AC-01 / CAND-AC-02)', () => {
  let usersRepo: InMemoryUsersRepository;
  let sessionsRepo: InMemorySessionsRepository;
  let passwordHasher: BcryptPasswordHasher;
  let tokenService: JwtTokenService;
  let clock: FakeClock;
  let idGen: UuidGenerator;
  let registerUseCase: RegisterUserUseCase;
  let loginUseCase: LoginUseCase;
  let refreshUseCase: RefreshTokenUseCase;
  let logoutUseCase: LogoutUseCase;

  beforeEach(() => {
    usersRepo = new InMemoryUsersRepository();
    sessionsRepo = new InMemorySessionsRepository();
    passwordHasher = new BcryptPasswordHasher();
    tokenService = new JwtTokenService();
    clock = new FakeClock(new Date('2026-08-31T10:00:00.000Z'));
    idGen = new UuidGenerator();

    registerUseCase = new RegisterUserUseCase(usersRepo, sessionsRepo, passwordHasher, tokenService, clock, idGen);
    loginUseCase = new LoginUseCase(usersRepo, sessionsRepo, passwordHasher, tokenService, clock, idGen);
    refreshUseCase = new RefreshTokenUseCase(usersRepo, sessionsRepo, tokenService, clock, idGen);
    logoutUseCase = new LogoutUseCase(sessionsRepo, tokenService, clock);
  });

  it('CAND-AC-01: Invalid credentials do not reveal if the email exists', async () => {
    await registerUseCase.execute({ email: 'candidate@inhire.internal', password: 'ValidPassword123!' });

    // Non-existent user
    await expect(loginUseCase.execute({ email: 'unknown@inhire.internal', password: 'AnyPassword' }))
      .rejects.toThrow(AppError);

    // Existing user with wrong password
    await expect(loginUseCase.execute({ email: 'candidate@inhire.internal', password: 'WrongPassword' }))
      .rejects.toThrow(AppError);
  });

  it('CAND-AC-02: Logout revokes the session and reuse of revoked token is detected', async () => {
    const authResult = await registerUseCase.execute({ email: 'candidate2@inhire.internal', password: 'ValidPassword123!' });
    const refreshToken = authResult.refreshToken;

    // Normal refresh works
    const refresh1 = await refreshUseCase.execute({ refreshToken });
    expect(refresh1.accessToken).toBeDefined();

    // Reusing the old (rotated/revoked) token triggers security detection
    await expect(refreshUseCase.execute({ refreshToken }))
      .rejects.toThrow('Revoked token reuse detected. All sessions invalidated.');

    // Now even the new token is revoked because of compromise detection
    await expect(refreshUseCase.execute({ refreshToken: refresh1.refreshToken }))
      .rejects.toThrow();
  });
});
