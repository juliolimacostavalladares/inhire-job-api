import { UserRole } from '../../domain/role.vo';

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
}

export interface TokenService {
  generateAccessToken(payload: JwtPayload): string;
  generateRefreshToken(): string;
  hashRefreshToken(token: string): string;
  verifyAccessToken(token: string): JwtPayload;
}

export const TOKEN_SERVICE = Symbol('TokenService');
