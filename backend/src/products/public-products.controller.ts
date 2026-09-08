import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ProductsService } from './products.service';
import { QueryPublicProductsDto } from './dto/query-public-products.dto';

@Controller('public/products')
@Public()
export class PublicProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  listPublic(@Query() query: QueryPublicProductsDto) {
    return this.productsService.listPublicCatalog(query);
  }
}
