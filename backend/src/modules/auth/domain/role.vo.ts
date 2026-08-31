export type UserRole = 'CANDIDATE' | 'ADMIN';

export class Role {
  static readonly CANDIDATE: UserRole = 'CANDIDATE';
  static readonly ADMIN: UserRole = 'ADMIN';

  static isValid(role: string): role is UserRole {
    return role === 'CANDIDATE' || role === 'ADMIN';
  }
}
