import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';

function parseOriginList(value?: string): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveCorsOrigins(configService: ConfigService): string[] {
  const origins = new Set<string>();

  for (const origin of parseOriginList(configService.get<string>('ALLOWED_ORIGINS'))) {
    origins.add(origin);
  }
  for (const origin of parseOriginList(configService.get<string>('CORS_ORIGIN'))) {
    origins.add(origin);
  }

  const frontendUrl = configService.get<string>('FRONTEND_URL')?.trim();
  if (frontendUrl) {
    origins.add(frontendUrl);
  }

  if (origins.size === 0) {
    origins.add('http://localhost:3000');
    origins.add('http://localhost:3001');
  }

  return [...origins];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bodyParser: false,
  });
  
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Large JSON bodies (restore uploads) — must be registered before routes
  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ limit: '100mb', extended: true }));
  app.use(cookieParser());

  // Security middleware - disable CSP in helmet (let Nginx handle it for PWA compatibility)
  app.use(helmet({
    contentSecurityPolicy: false, // ⚡ DISABLED - Nginx handles CSP for better PWA support
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  
  const corsOrigins = resolveCorsOrigins(configService);

  // CORS — driven by ALLOWED_ORIGINS, CORS_ORIGIN, FRONTEND_URL
  const corsOptions = {
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-Request-Id',
      'X-Correlation-Id',
      'X-Financial-Access-Token',
    ],
    exposedHeaders: ['Content-Disposition', 'Content-Length', 'X-Response-Time'],
    credentials: true,
    maxAge: 3600,
  };
  app.enableCors(corsOptions);
  
  // Compression — skip backup downloads (avoids premature close on large JSON)
  app.use(
    compression.default({
      filter: (req, res) => {
        const url = req.url || '';
        if (url.includes('/settings/backup')) {
          return false;
        }
        return compression.filter(req, res);
      },
    }),
  );
  
  // Global prefix
  app.setGlobalPrefix('api');
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));
  
  // Trust proxy for production
  if (configService.get('NODE_ENV') === 'production') {
    // Use the correct method for setting trust proxy
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  
  // Swagger documentation
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Doocard Salon Management API')
      .setDescription('API documentation for Doocard Salon Management System')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management')
      .addTag('customers', 'Customer management')
      .addTag('barbers', 'Barber management')
      .addTag('appointments', 'Appointment management')
      .addTag('services', 'Service management')
      .addTag('accounting', 'Financial management')
      .addTag('sms', 'SMS management')
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }
  
  // Global exception filter
  // app.useGlobalFilters(new HttpExceptionFilter());
  
  // Global interceptors
  // app.useGlobalInterceptors(new TransformInterceptor());
  
  const port = configService.get('PORT', 3001);
  const host = configService.get('HOST', '0.0.0.0');
  
  await app.listen(port, host);

  const httpServer = app.getHttpServer();
  httpServer.setTimeout(10 * 60 * 1000);
  if ('requestTimeout' in httpServer) {
    (httpServer as any).requestTimeout = 10 * 60 * 1000;
  }
  if ('headersTimeout' in httpServer) {
    (httpServer as any).headersTimeout = 10 * 60 * 1000;
  }
  
  logger.log(`🚀 Application is running on: http://${host}:${port}`);
  logger.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
  logger.log(`🌍 Environment: ${configService.get('NODE_ENV', 'development')}`);
  logger.log(`🔒 CORS Origins: ${corsOrigins.join(', ')}`);
  
  // Graceful shutdown
  const gracefulShutdown = (signal: string) => {
    logger.log(`Received ${signal}, starting graceful shutdown...`);
    // Use the correct method for closing the app
    app.close().then(() => {
      logger.log('Graceful shutdown completed');
      process.exit(0);
    }).catch((error) => {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    });
  };
  
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
