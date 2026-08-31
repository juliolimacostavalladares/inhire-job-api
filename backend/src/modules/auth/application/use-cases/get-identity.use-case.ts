import { Injectable, Inject } from '@nestjs/common';
import { USERS_REPOSITORY, UsersRepository } from '../ports/users.repository';
import { IdentityDto } from '../dto/auth.dto';
import { AppError } from '@shared/domain/errors/app-error';

@Injectable()
export class GetIdentityUseCase {
  constructor(@Inject(USERS_REPOSITORY) private readonly usersRepo: UsersRepository) {}

  async execute(userId: string): Promise<IdentityDto> {
    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }
}
