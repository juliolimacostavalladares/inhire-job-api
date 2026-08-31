import { User } from '../../domain/user.entity';

export interface UsersRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<User>;
}

export const USERS_REPOSITORY = Symbol('UsersRepository');
