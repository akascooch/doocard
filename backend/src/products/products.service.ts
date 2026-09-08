import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, InventoryMovementType } from '@prisma/client';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInventoryMovementDto,
  CreateProductCategoryDto,
  CreateProductDto,
  ManualInventoryMovementType,
  QueryMovementsDto,
  QueryProductsDto,
  QueryPublicProductsDto,
  UpdateProductCategoryDto,
  UpdateProductDto,
} from './dto';

const PRODUCT_UPLOAD_DIR = join(process.cwd(), 'uploads', 'products');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function serializeProduct<T extends { priceRial: bigint; images: Prisma.JsonValue | null }>(
  product: T,
) {
  return {
    ...product,
    priceRial: product.priceRial.toString(),
    images: Array.isArray(product.images)
      ? (product.images as unknown[]).filter((x) => typeof x === 'string')
      : [],
  };
}

function serializeMovement<
  T extends { unitCostRial: bigint | null; quantity: number },
>(movement: T) {
  return {
    ...movement,
    unitCostRial: movement.unitCostRial == null ? null : movement.unitCostRial.toString(),
  };
}

function uniqueConflict(error: Prisma.PrismaClientKnownRequestError): never {
  const target = Array.isArray(error.meta?.target) ? (error.meta.target as string[]) : [];
  if (target.some((t) => t.includes('sku'))) {
    throw new ConflictException('کد کالا (SKU) تکراری است');
  }
  if (target.some((t) => t.includes('barcode'))) {
    throw new ConflictException('بارکد تکراری است');
  }
  throw new ConflictException('مقدار تکراری است');
}

const PUBLIC_IMAGE = /^\/uploads\/products\/[A-Za-z0-9._-]+$/;

function publicImages(images: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(images)) return [];
  return images.filter(
    (item): item is string => typeof item === 'string' && PUBLIC_IMAGE.test(item),
  );
}

function toPublicProduct(row: {
  id: number;
  name: string;
  description: string | null;
  images: Prisma.JsonValue | null;
  priceRial: bigint;
  isPriceVisible: boolean;
  category: { id: number; name: string } | null;
}) {
  const priceVisible = row.isPriceVisible;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    images: publicImages(row.images),
    category: {
      id: row.category!.id,
      name: row.category!.name,
    },
    priceRial: priceVisible ? row.priceRial.toString() : null,
    priceVisible,
    isPriceVisible: priceVisible,
  };
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  listCategories() {
    return this.prisma.productCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  createCategory(dto: CreateProductCategoryDto) {
    return this.prisma.productCategory.create({
      data: {
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateCategory(id: number, dto: UpdateProductCategoryDto) {
    await this.requireCategory(id);
    return this.prisma.productCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deactivateCategory(id: number) {
    await this.requireCategory(id);
    return this.prisma.productCategory.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async listProducts(query: QueryProductsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.ProductWhereInput = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      data: rows.map(serializeProduct),
      page,
      limit,
      total,
    };
  }

  /**
   * Customer catalog. Explicit fields only — never spread the Prisma row.
   * Active product + active category required. Stock/SKU/cost/timestamps stay off the wire.
   */
  async listPublicCatalog(query: QueryPublicProductsDto) {
    const search = query.search?.trim();
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      category: { isActive: true },
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [categories, rows] = await this.prisma.$transaction([
      this.prisma.productCategory.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          images: true,
          priceRial: true,
          isPriceVisible: true,
          category: { select: { id: true, name: true } },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: 100,
      }),
    ]);

    return {
      categories,
      products: rows
        .filter((row) => row.category != null)
        .map((row) => toPublicProduct(row)),
    };
  }

  async getProduct(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException('محصول یافت نشد');
    }
    return serializeProduct(product);
  }

  async createProduct(dto: CreateProductDto) {
    if (dto.categoryId) {
      await this.requireCategory(dto.categoryId, true);
    }
    try {
      const initialStock = dto.stock ?? 0
      const created = await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            name: dto.name.trim(),
            sku: dto.sku?.trim() || null,
            barcode: dto.barcode?.trim() || null,
            description: dto.description?.trim() || null,
            priceRial: BigInt(dto.priceRial),
            isPriceVisible: dto.isPriceVisible ?? false,
            stock: initialStock,
            lowStockAlert: dto.lowStockAlert ?? null,
            categoryId: dto.categoryId ?? null,
            isActive: dto.isActive ?? true,
            images: dto.images ?? [],
          },
          include: { category: true },
        })
        if (initialStock > 0) {
          await tx.inventoryMovement.create({
            data: {
              productId: product.id,
              type: InventoryMovementType.IN,
              quantity: initialStock,
              reason: 'موجودی اولیه',
              referenceType: 'MANUAL',
            },
          })
        }
        return product
      })
      return serializeProduct(created)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        uniqueConflict(error);
      }
      throw error;
    }
  }

  async updateProduct(id: number, dto: UpdateProductDto) {
    await this.requireProduct(id);
    if (dto.categoryId) {
      await this.requireCategory(dto.categoryId, true);
    }
    try {
      const updated = await this.prisma.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.sku !== undefined ? { sku: dto.sku.trim() || null } : {}),
          ...(dto.barcode !== undefined ? { barcode: dto.barcode.trim() || null } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || null }
            : {}),
          ...(dto.priceRial !== undefined ? { priceRial: BigInt(dto.priceRial) } : {}),
          ...(dto.isPriceVisible !== undefined ? { isPriceVisible: dto.isPriceVisible } : {}),
          ...(dto.lowStockAlert !== undefined ? { lowStockAlert: dto.lowStockAlert } : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(dto.images !== undefined ? { images: dto.images } : {}),
        },
        include: { category: true },
      });
      return serializeProduct(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        uniqueConflict(error);
      }
      throw error;
    }
  }

  async deactivateProduct(id: number) {
    await this.requireProduct(id);
    const updated = await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: { category: true },
    });
    return serializeProduct(updated);
  }

  async createMovement(productId: number, dto: CreateInventoryMovementDto, userId?: number) {
    if (dto.type !== ManualInventoryMovementType.ADJUSTMENT && dto.quantity < 1) {
      throw new BadRequestException('تعداد ورود/خروج باید حداقل ۱ باشد');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new NotFoundException('محصول یافت نشد');
      }

      let movementQty = dto.quantity;
      let nextStock = product.stock;

      if (dto.type === ManualInventoryMovementType.IN) {
        const affected = await tx.$executeRaw`
          UPDATE "products"
          SET stock = stock + ${dto.quantity}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = ${productId}
        `;
        if (affected === 0) {
          throw new NotFoundException('محصول یافت نشد');
        }
        nextStock = product.stock + dto.quantity;
        movementQty = dto.quantity;
      } else if (dto.type === ManualInventoryMovementType.OUT) {
        const affected = await tx.$executeRaw`
          UPDATE "products"
          SET stock = stock - ${dto.quantity}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = ${productId} AND stock >= ${dto.quantity}
        `;
        if (affected === 0) {
          throw new ConflictException('موجودی کافی نیست');
        }
        nextStock = product.stock - dto.quantity;
        movementQty = -dto.quantity;
      } else {
        const rows = await tx.$queryRaw<Array<{ stock: number }>>`
          SELECT stock FROM "products" WHERE id = ${productId} FOR UPDATE
        `;
        const current = rows[0]?.stock;
        if (current == null) {
          throw new NotFoundException('محصول یافت نشد');
        }
        const delta = dto.quantity - current;
        await tx.$executeRaw`
          UPDATE "products"
          SET stock = ${dto.quantity}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = ${productId}
        `;
        nextStock = dto.quantity;
        movementQty = delta;
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          productId,
          type: dto.type as InventoryMovementType,
          quantity: movementQty,
          unitCostRial: dto.unitCostRial == null ? null : BigInt(dto.unitCostRial),
          reason: dto.reason?.trim() || null,
          performedById: userId ?? null,
          referenceType: 'MANUAL',
        },
        include: {
          performedBy: { select: { id: true, name: true } },
        },
      });

      return {
        ...serializeMovement(movement),
        stock: nextStock,
      };
    });
  }

  async listMovements(productId: number, query: QueryMovementsDto) {
    await this.requireProduct(productId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = { productId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.count({ where }),
      this.prisma.inventoryMovement.findMany({
        where,
        include: { performedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    return {
      data: rows.map(serializeMovement),
      page,
      limit,
      total,
    };
  }

  async inventorySummary() {
    const products = await this.prisma.product.findMany({
      include: {
        category: { select: { id: true, name: true } },
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { performedBy: { select: { id: true, name: true } } },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    return products.map((p) => {
      const last = p.movements[0] ?? null;
      const isLowStock =
        p.lowStockAlert != null && p.stock <= p.lowStockAlert;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        stock: p.stock,
        lowStockAlert: p.lowStockAlert,
        isActive: p.isActive,
        isLowStock,
        priceRial: p.priceRial.toString(),
        lastMovement: last ? serializeMovement(last) : null,
      };
    });
  }

  saveUpload(file: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('فایل تصویر الزامی است');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('حجم تصویر حداکثر ۵ مگابایت است');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('فقط JPEG، PNG یا WebP مجاز است');
    }
    mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true });
    const ext =
      file.mimetype === 'image/png'
        ? '.png'
        : file.mimetype === 'image/webp'
          ? '.webp'
          : '.jpg';
    const name = `${randomUUID()}${ext}`;
    writeFileSync(join(PRODUCT_UPLOAD_DIR, name), file.buffer);
    return { url: `/uploads/products/${name}` };
  }

  private async requireProduct(id: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('محصول یافت نشد');
    }
    return product;
  }

  private async requireCategory(id: number, mustBeActive = false) {
    const category = await this.prisma.productCategory.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('دسته‌بندی یافت نشد');
    }
    if (mustBeActive && !category.isActive) {
      throw new BadRequestException('دسته‌بندی غیرفعال است');
    }
    return category;
  }
}
