import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { SettingsController } from './settings.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    MulterModule.register({
      dest: './uploads',
    }),
    PrismaModule,
  ],
  controllers: [SettingsController],
})
export class SettingsModule {} 