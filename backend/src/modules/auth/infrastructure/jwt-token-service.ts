import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { TokenService, JwtPayload } from '../application/ports/token-service.port';
import { AppError } from '@shared/domain/errors/app-error';

@Injectable()
export class JwtTokenService implements TokenService {
  private readonly secret: string;
  private readonly expiresInSeconds: number;

  constructor() {
    this.secret = process.env.JWT_SECRET || 'inhire-super-secret-jwt-key-2026-strict';
    this.expiresInSeconds = 900; // 15 minutes
  }

  generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresInSeconds });
  }

  generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.secret) as JwtPayload;
      return decoded;
    } catch {
      throw AppError.unauthenticated('Invalid or expired token');
    }
  }
}
