import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { config } from './config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableShutdownHooks();
  // Internal-only service: reachable on the Docker network, never published.
  await app.listen(config.port, '0.0.0.0');
  new Logger('Bootstrap').log(`Notification service listening on :${config.port}`);
}

bootstrap();
