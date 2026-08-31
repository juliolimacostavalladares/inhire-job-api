import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/inhire?schema=public',
        },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      await this.$connect().catch(() => {});
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      await this.$disconnect().catch(() => {});
    }
  }
}
