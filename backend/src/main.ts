import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/infrastructure/filters/http-exception.filter';
import { CorrelationIdInterceptor } from './shared/infrastructure/interceptors/correlation-id.interceptor';
import { SanitizedLogger } from './shared/infrastructure/logger/sanitized-logger.service';
import { ValidationPipe } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

async function bootstrap() {
  process.env.PROCESS_TYPE = 'api';
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(SanitizedLogger);
  app.useLogger(logger);

  // Mount Bull-Board UI Dashboard at /admin/queues
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const redisConnection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const queueNames = [
    'tenant-discovery',
    'job-collection',
    'profile-analysis',
    'resume-generation',
    'job-application',
    'auto-apply',
  ];

  const queues = queueNames.map(
    (name) => new Queue(name, { connection: redisConnection }),
  );

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new CorrelationIdInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log({ message: `InHire Backend API listening on port ${port}` }, 'Bootstrap');
  logger.log({ message: `BullMQ Dashboard running at http://localhost:${port}/admin/queues` }, 'Bootstrap');
}

bootstrap();
