import { UserRole } from '../../domain/role.vo';

export interface RegisterDto {
  email: string;
  password: string;
  role?: UserRole;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RefreshDto {
  refreshToken: string;
}

export interface LogoutDto {
  refreshToken: string;
}

export interface AuthResultDto {
  user: {
    id: string;
    email: string;
    role: UserRole;
    createdAt: Date;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface IdentityDto {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}
