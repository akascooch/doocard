import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { PublicProductsController } from './public-products.controller';
import { ProductsService } from './products.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WaitlistModule } from '../waitlist/waitlist.module';

@Module({
  imports: [PrismaModule, WaitlistModule],
  controllers: [ProductsController, PublicProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
