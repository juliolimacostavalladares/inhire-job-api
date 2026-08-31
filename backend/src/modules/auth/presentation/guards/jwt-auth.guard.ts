import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Request } from 'express';
import { TOKEN_SERVICE, TokenService } from '../../application/ports/token-service.port';
import { AppError } from '@shared/domain/errors/app-error';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_SERVICE) private readonly tokenService: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthenticated('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);
    const payload = this.tokenService.verifyAccessToken(token);
    (request as unknown as { user: unknown }).user = payload;
    return true;
  }
}
