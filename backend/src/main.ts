import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  
  // Security middleware - disable CSP in helmet (let Nginx handle it for PWA compatibility)
  app.use(helmet({
    contentSecurityPolicy: false, // ⚡ DISABLED - Nginx handles CSP for better PWA support
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));
  
  // CORS configuration
  const corsOptions = {
    origin: configService.get('ALLOWED_ORIGINS', 'http://localhost:3000').split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'X-Request-Id',
      'X-Correlation-Id',
    ],
    exposedHeaders: [
      'X-Correlation-Id',
      'X-Request-Id',
      'X-Response-Time',
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
  };
  app.enableCors(corsOptions);
  
  // Compression middleware
  app.use(compression.default());
  
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
  
  logger.log(`🚀 Application is running on: http://${host}:${port}`);
  logger.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
  logger.log(`🌍 Environment: ${configService.get('NODE_ENV', 'development')}`);
  logger.log(`🔒 CORS Origins: ${corsOptions.origin}`);
  
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
