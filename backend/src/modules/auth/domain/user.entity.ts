import { UserRole } from './role.vo';

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  constructor(private readonly props: UserProps) {}

  get id(): string {
    return this.props.id;
  }

  get email(): string {
    return this.props.email;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  static create(props: { id: string; email: string; passwordHash: string; role?: UserRole; now?: Date }): User {
    const emailNormalized = props.email.trim().toLowerCase();
    const now = props.now ?? new Date();
    return new User({
      id: props.id,
      email: emailNormalized,
      passwordHash: props.passwordHash,
      role: props.role ?? 'CANDIDATE',
      createdAt: now,
      updatedAt: now,
    });
  }
}
