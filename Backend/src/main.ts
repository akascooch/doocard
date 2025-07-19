import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  
  app.useGlobalPipes(new ValidationPipe());
  
  // تنظیمات CORS
  app.enableCors({
    origin: 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  const configService = app.get(ConfigService);
  const jwtSecret = configService.get('jwt.secret');
  if (!jwtSecret) {
    throw new Error('JWT secret is not defined');
  }

  await app.listen(3001);
  console.log(`🚀 Backend is running at http://localhost:3001`);
}
bootstrap();
