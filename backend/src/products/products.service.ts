import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, InventoryMovementType } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInventoryMovementDto,
  CreateProductCategoryDto,
  CreateProductDto,
  CreateProductPackagingDto,
  ManualInventoryMovementType,
  QueryKardexDto,
  QueryMovementsDto,
  QueryProductsDto,
  QueryPublicProductsDto,
  UpdateProductCategoryDto,
  UpdateProductDto,
  UpdateProductPackagingDto,
} from './dto';
import { toPublicCatalogProduct } from './public-product.util';
import { StockNotificationService } from '../waitlist/stock-notification.service';

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

function parseIsoBound(value: string | undefined, endOfDay: boolean): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00'}+03:30`);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

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
  stock: number;
  category: { id: number; name: string } | null;
}) {
  return toPublicCatalogProduct({
    id: row.id,
    name: row.name,
    description: row.description,
    images: publicImages(row.images),
    priceRial: row.priceRial,
    isPriceVisible: row.isPriceVisible,
    stock: row.stock,
    category: {
      id: row.category!.id,
      name: row.category!.name,
    },
  });
}

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    @Optional() private readonly stockNotifications?: StockNotificationService,
  ) {}

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
    const productCount = await this.prisma.product.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      throw new BadRequestException(
        'امکان حذف دسته‌بندی دارای محصول وجود ندارد. ابتدا محصولات را منتقل یا حذف کنید.',
      );
    }
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
   * Active product + active category required.
   * Public stock is remaining sellable quantity only. SKU/cost/lowStockAlert/timestamps stay off the wire.
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
          stock: true,
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
      include: { category: true, packagings: { where: { isActive: true }, orderBy: { id: 'asc' } } },
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

    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new NotFoundException('محصول یافت نشد');
      }

      let movementQty = dto.quantity;
      let previousStock = product.stock;
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
        previousStock = current;
        const delta = dto.quantity - current;
        await tx.$executeRaw`
          UPDATE "products"
          SET stock = ${dto.quantity}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE id = ${productId}
        `;
        nextStock = dto.quantity;
        movementQty = delta;
      }

      let packagingSnap: {
        packagingId: number;
        packagingName: string;
        packagingUnit: string;
        unitsPerPackage: number;
      } | null = null;
      if (dto.packagingId) {
        const packaging = await tx.productPackaging.findFirst({
          where: { id: dto.packagingId, productId, isActive: true },
        });
        if (!packaging) {
          throw new NotFoundException('بسته‌بندی این محصول یافت نشد');
        }
        packagingSnap = {
          packagingId: packaging.id,
          packagingName: packaging.name,
          packagingUnit: packaging.unitLabel,
          unitsPerPackage: packaging.unitsPerPackage,
        };
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
          ...(packagingSnap ?? {}),
        },
        include: {
          performedBy: { select: { id: true, name: true } },
        },
      });

      return {
        movement: {
          ...serializeMovement(movement),
          stock: nextStock,
        },
        previousStock,
        nextStock,
      };
    });

    this.stockNotifications?.notifyIfBackInStock(productId, result.previousStock, result.nextStock);
    return result.movement;
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

  async listPackagings(productId: number) {
    await this.requireProduct(productId);
    return this.prisma.productPackaging.findMany({
      where: { productId },
      orderBy: [{ isActive: 'desc' }, { id: 'asc' }],
    });
  }

  async createPackaging(productId: number, dto: CreateProductPackagingDto) {
    await this.requireProduct(productId);
    return this.prisma.productPackaging.create({
      data: {
        productId,
        name: dto.name.trim(),
        unitLabel: dto.unitLabel.trim(),
        unitsPerPackage: dto.unitsPerPackage,
      },
    });
  }

  async updatePackaging(productId: number, packagingId: number, dto: UpdateProductPackagingDto) {
    await this.requireOwnedPackaging(productId, packagingId);
    return this.prisma.productPackaging.update({
      where: { id: packagingId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.unitLabel !== undefined ? { unitLabel: dto.unitLabel.trim() } : {}),
        ...(dto.unitsPerPackage !== undefined ? { unitsPerPackage: dto.unitsPerPackage } : {}),
      },
    });
  }

  async deletePackaging(productId: number, packagingId: number) {
    const packaging = await this.requireOwnedPackaging(productId, packagingId);
    const [movements, appointmentLines, orderLines] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.count({ where: { packagingId } }),
      this.prisma.appointmentProduct.count({ where: { packagingId } }),
      this.prisma.orderItem.count({ where: { packagingId } }),
    ]);
    const referenced = movements + appointmentLines + orderLines;
    if (referenced > 0) {
      const archived = await this.prisma.productPackaging.update({
        where: { id: packagingId },
        data: { isActive: false, archivedAt: new Date() },
      });
      return { ok: true, deleted: false, archived: true, packaging: archived };
    }
    await this.prisma.productPackaging.delete({ where: { id: packaging.id } });
    return { ok: true, deleted: true, id: packagingId };
  }

  async getKardex(productId: number, query: QueryKardexDto) {
    const product = await this.requireProduct(productId);
    const from = parseIsoBound(query.from, false);
    const to = parseIsoBound(query.to, true);
    if (query.from && !from) {
      throw new BadRequestException('تاریخ شروع نامعتبر است');
    }
    if (query.to && !to) {
      throw new BadRequestException('تاریخ پایان نامعتبر است');
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const movements = await this.prisma.inventoryMovement.findMany({
      where: {
        productId,
        ...(to ? { createdAt: { lte: to } } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { performedBy: { select: { id: true, name: true } } },
    });

    const appointmentIds = [
      ...new Set(
        movements
          .filter((row) => row.referenceType === 'APPOINTMENT' && row.referenceId != null)
          .map((row) => row.referenceId as number),
      ),
    ];
    const appointmentNames = new Map<
      number,
      { barberName: string | null; customerName: string | null }
    >();
    if (appointmentIds.length > 0) {
      const appointments = await this.prisma.appointment.findMany({
        where: { id: { in: appointmentIds } },
        select: {
          id: true,
          employee: { select: { user: { select: { name: true } } } },
          customer: { select: { user: { select: { name: true } } } },
        },
      });
      for (const appointment of appointments) {
        appointmentNames.set(appointment.id, {
          barberName: appointment.employee?.user?.name ?? null,
          customerName: appointment.customer?.user?.name ?? null,
        });
      }
    }

    let running = 0;
    const withBalance = movements.map((row) => {
      running += row.quantity;
      const isAppointment = row.referenceType === 'APPOINTMENT' && row.referenceId != null;
      const names = isAppointment ? appointmentNames.get(row.referenceId!) : undefined;
      return {
        id: row.id,
        occurredAt: row.createdAt.toISOString(),
        type: row.type,
        quantity: row.quantity,
        quantityIn: row.quantity > 0 ? row.quantity : 0,
        quantityOut: row.quantity < 0 ? -row.quantity : 0,
        balanceAfter: running,
        unitLabel: row.packagingUnit || 'عدد',
        packagingName: row.packagingName,
        unitsPerPackage: row.unitsPerPackage,
        reason: row.reason,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        performedByName: row.performedBy?.name ?? null,
        barberName: names?.barberName ?? null,
        customerName: names?.customerName ?? null,
        appointmentId: isAppointment ? String(row.referenceId) : null,
      };
    });

    const filtered = from
      ? withBalance.filter((row) => new Date(row.occurredAt).getTime() >= from.getTime())
      : withBalance;
    const total = filtered.length;
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);
    const beforeFrom = from
      ? withBalance.filter((row) => new Date(row.occurredAt).getTime() < from.getTime())
      : [];
    const openingBalance = beforeFrom.length
      ? beforeFrom[beforeFrom.length - 1].balanceAfter
      : 0;

    return {
      product: {
        id: product.id,
        name: product.name,
        stock: product.stock,
      },
      openingBalance,
      page,
      limit,
      total,
      data,
    };
  }

  private async requireOwnedPackaging(productId: number, packagingId: number) {
    await this.requireProduct(productId);
    const packaging = await this.prisma.productPackaging.findUnique({ where: { id: packagingId } });
    if (!packaging || packaging.productId !== productId) {
      throw new NotFoundException('بسته‌بندی این محصول یافت نشد');
    }
    return packaging;
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
