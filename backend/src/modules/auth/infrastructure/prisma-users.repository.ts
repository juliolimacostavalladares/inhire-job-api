import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UsersRepository } from '../application/ports/users.repository';
import { User } from '../domain/user.entity';
import { UserRole } from '../domain/role.vo';

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    if (!record) return null;
    return new User({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      role: record.role as UserRole,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({ where: { email } });
    if (!record) return null;
    return new User({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      role: record.role as UserRole,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async create(user: User): Promise<User> {
    const record = await this.prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
    return new User({
      id: record.id,
      email: record.email,
      passwordHash: record.passwordHash,
      role: record.role as UserRole,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
