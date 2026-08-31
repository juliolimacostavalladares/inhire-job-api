import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/infrastructure/filters/http-exception.filter';
import { CorrelationIdInterceptor } from './shared/infrastructure/interceptors/correlation-id.interceptor';
import { SanitizedLogger } from './shared/infrastructure/logger/sanitized-logger.service';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  process.env.PROCESS_TYPE = 'api';
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(SanitizedLogger);
  app.useLogger(logger);

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
}

bootstrap();
