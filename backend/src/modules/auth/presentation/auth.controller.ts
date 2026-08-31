import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { RefreshTokenUseCase } from '../application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { GetIdentityUseCase } from '../application/use-cases/get-identity.use-case';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from '../application/ports/token-service.port';

@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getIdentityUseCase: GetIdentityUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: { email: string; password: string; role?: 'CANDIDATE' | 'ADMIN' }) {
    return this.registerUserUseCase.execute(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    return this.loginUseCase.execute(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken: string }) {
    return this.refreshTokenUseCase.execute(body);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: { refreshToken: string }) {
    await this.logoutUseCase.execute(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getIdentity(@CurrentUser() user: JwtPayload) {
    return this.getIdentityUseCase.execute(user.sub);
  }
}
