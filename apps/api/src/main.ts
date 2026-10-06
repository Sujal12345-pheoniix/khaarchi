import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { validateApiEnv } from '@homeexpense/validation';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('HomeExpenseAPI');

  // 1. Runtime environment validation (Security / Reliability)
  const env = validateApiEnv(process.env);
  logger.log(`Runtime environment validated successfully: ${env.NODE_ENV}`);

  const app = await NestFactory.create(AppModule);

  // Security Headers via Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Retain compatibility with Swagger UI OpenAPI docs
      crossOriginEmbedderPolicy: false,
    })
  );

  app.setGlobalPrefix('api/v1', {
    exclude: ['health'], // Allow both /health and /api/v1/health
  });

  app.enableCors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('HomeExpense API')
    .setDescription('Financial operating system for bachelors, roommates, and families')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = env.PORT || 4000;
  await app.listen(port);
  logger.log(`HomeExpense API is running on: http://localhost:${port}/api/v1`);
  logger.log(`Health check available at: http://localhost:${port}/health`);
  logger.log(`OpenAPI documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('[FATAL] Bootstrap failure:', err);
  process.exit(1);
});
