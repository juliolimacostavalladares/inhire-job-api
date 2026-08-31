import { Module } from '@nestjs/common';
import { AuthController } from './presentation/auth.controller';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { GetIdentityUseCase } from './application/use-cases/get-identity.use-case';
import { USERS_REPOSITORY } from './application/ports/users.repository';
import { SESSIONS_REPOSITORY } from './application/ports/sessions.repository';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import { TOKEN_SERVICE } from './application/ports/token-service.port';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository';
import { PrismaSessionsRepository } from './infrastructure/prisma-sessions.repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { JwtTokenService } from './infrastructure/jwt-token-service';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';
import { RolesGuard } from './presentation/guards/roles.guard';
import { CLOCK_PORT } from '@shared/domain/ports/clock.port';
import { SystemClock } from '@shared/infrastructure/clock/system-clock';
import { ID_GENERATOR_PORT } from '@shared/domain/ports/id-generator.port';
import { UuidGenerator } from '@shared/infrastructure/id-generator/uuid-generator';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Module({
  controllers: [AuthController],
  providers: [
    PrismaService,
    RegisterUserUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    GetIdentityUseCase,
    JwtAuthGuard,
    RolesGuard,
    { provide: USERS_REPOSITORY, useClass: PrismaUsersRepository },
    { provide: SESSIONS_REPOSITORY, useClass: PrismaSessionsRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: CLOCK_PORT, useClass: SystemClock },
    { provide: ID_GENERATOR_PORT, useClass: UuidGenerator },
  ],
  exports: [
    JwtAuthGuard,
    RolesGuard,
    TOKEN_SERVICE,
    USERS_REPOSITORY,
    GetIdentityUseCase,
  ],
})
export class AuthModule {}
