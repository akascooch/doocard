import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get('app.isProduction');
        const logLevel = config.get('logging.level', 'info');

        const transports: winston.transport[] = [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.colorize(),
              winston.format.printf(({ timestamp, level, message, context, trace }) => {
                return `${timestamp} [${context}] ${level}: ${message}${trace ? `\n${trace}` : ''}`;
              }),
            ),
          }),
        ];

        if (isProduction) {
          // Production file logging
          const logDir = 'logs';
          
          transports.push(
            new winston.transports.File({
              filename: `${logDir}/application.log`,
              maxsize: 10 * 1024 * 1024, // 10MB
              maxFiles: 5,
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json(),
              ),
            }),
            new winston.transports.File({
              filename: `${logDir}/error.log`,
              level: 'error',
              maxsize: 10 * 1024 * 1024, // 10MB
              maxFiles: 5,
              format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json(),
              ),
            }),
          );
        }

        return {
          level: logLevel,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.metadata(),
            winston.format.json(),
          ),
          transports,
          exitOnError: false,
        };
      },
    }),
  ],
  exports: [WinstonModule],
})
export class AppLoggerModule {}
