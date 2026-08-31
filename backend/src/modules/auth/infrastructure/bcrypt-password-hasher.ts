import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PasswordHasher } from '../application/ports/password-hasher.port';

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
