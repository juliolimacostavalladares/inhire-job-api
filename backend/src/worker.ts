import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { SanitizedLogger } from './shared/infrastructure/logger/sanitized-logger.service';

async function bootstrapWorker() {
  process.env.PROCESS_TYPE = 'worker';
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });

  const logger = app.get(SanitizedLogger);
  app.useLogger(logger);

  logger.log({ message: 'InHire Background Worker started successfully' }, 'WorkerBootstrap');

  const shutdown = async () => {
    logger.log({ message: 'Shutting down worker gracefully...' }, 'WorkerShutdown');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrapWorker();
