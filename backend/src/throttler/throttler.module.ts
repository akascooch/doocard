import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get('security.rateLimit.ttl', 60) * 1000, // Convert to milliseconds
          limit: config.get('security.rateLimit.limit', 100),
          name: 'short',
        },
        {
          ttl: 60 * 60 * 1000, // 1 hour
          limit: config.get('security.rateLimit.limit', 100) * 10, // 10x the short limit
          name: 'long',
        },
        {
          ttl: 24 * 60 * 60 * 1000, // 24 hours
          limit: config.get('security.rateLimit.limit', 100) * 100, // 100x the short limit
          name: 'daily',
        },
      ],
    }),
  ],
  exports: [ThrottlerModule],
})
export class AppThrottlerModule {}
