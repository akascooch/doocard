import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { ProductsService } from './products.service';
import {
  CreateInventoryMovementDto,
  CreateProductCategoryDto,
  CreateProductDto,
  QueryMovementsDto,
  QueryProductsDto,
  UpdateProductCategoryDto,
  UpdateProductDto,
} from './dto';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('categories')
  listCategories() {
    return this.productsService.listCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateProductCategoryDto) {
    return this.productsService.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.productsService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  deactivateCategory(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.deactivateCategory(id);
  }

  @Get('inventory/summary')
  inventorySummary() {
    return this.productsService.inventorySummary();
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          cb(new BadRequestException('فقط JPEG، PNG یا WebP مجاز است'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.productsService.saveUpload(file);
  }

  @Get()
  listProducts(@Query() query: QueryProductsDto) {
    return this.productsService.listProducts(query);
  }

  @Post()
  createProduct(@Body() dto: CreateProductDto) {
    return this.productsService.createProduct(dto);
  }

  @Get(':id/movements')
  listMovements(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryMovementsDto,
  ) {
    return this.productsService.listMovements(id, query);
  }

  @Post(':id/movements')
  createMovement(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateInventoryMovementDto,
    @Req() req: { user?: { id?: number } },
  ) {
    return this.productsService.createMovement(id, dto, req.user?.id);
  }

  @Get(':id')
  getProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.getProduct(id);
  }

  @Patch(':id')
  updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.updateProduct(id, dto);
  }

  @Delete(':id')
  deactivateProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.deactivateProduct(id);
  }
}
