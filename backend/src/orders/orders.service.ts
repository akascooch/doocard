import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma } from '@prisma/client';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomInt, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { SmsOutboundService } from '../sms/sms-outbound.service';
import { SMS_EVENT_KEYS } from '../sms/sms-event-keys';
import { SMS_TEMPLATE_KEYS } from '../sms/sms-template.catalog';
import { SMS_ALWAYS_CC_PHONES } from '../sms/sms-always-cc';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

const RECEIPT_UPLOAD_DIR = join(process.cwd(), 'uploads', 'receipts');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const RECEIPT_URL = /^\/uploads\/receipts\/[A-Za-z0-9._-]+$/;

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_VERIFICATION: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PAID: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly smsOutbound: SmsOutboundService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    mkdirSync(RECEIPT_UPLOAD_DIR, { recursive: true });
  }

  saveReceipt(file: Express.Multer.File): string {
    if (!file?.buffer?.length) {
      throw new BadRequestException('تصویر رسید کارت‌به‌کارت الزامی است');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('حجم تصویر حداکثر ۵ مگابایت است');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('فقط JPEG، PNG یا WebP مجاز است');
    }
    mkdirSync(RECEIPT_UPLOAD_DIR, { recursive: true });
    const ext =
      file.mimetype === 'image/png'
        ? '.png'
        : file.mimetype === 'image/webp'
          ? '.webp'
          : '.jpg';
    const name = `${randomUUID()}${ext}`;
    writeFileSync(join(RECEIPT_UPLOAD_DIR, name), file.buffer);
    const url = `/uploads/receipts/${name}`;
    if (!RECEIPT_URL.test(url)) {
      throw new BadRequestException('مسیر ذخیره رسید نامعتبر است');
    }
    return url;
  }

  async create(dto: CreateOrderDto, file: Express.Multer.File) {
    const receiptImageUrl = this.saveReceipt(file);
    try {
      const order = await this.createOrderRecord(dto, receiptImageUrl);
      this.notifyAdmins(order).catch((err) => {
        this.logger.warn(`Order notify failed: ${err?.message || 'unknown'}`);
      });
      return this.serializeOrder(order);
    } catch (error) {
      this.unlinkReceipt(receiptImageUrl);
      throw error;
    }
  }

  async list(query: OrderQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.OrderWhereInput = query.status
      ? { status: query.status }
      : {};

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: { items: { orderBy: { id: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      page,
      limit,
      total,
      orders: rows.map((row) => this.serializeOrder(row)),
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { orderBy: { id: 'asc' } } },
    });
    if (!order) {
      throw new NotFoundException('سفارش یافت نشد');
    }
    return this.serializeOrder(order);
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const existing = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      throw new NotFoundException('سفارش یافت نشد');
    }

    const allowed = STATUS_TRANSITIONS[existing.status];
    if (dto.status !== existing.status && !allowed.includes(dto.status)) {
      throw new BadRequestException(
        `تغییر وضعیت از ${existing.status} به ${dto.status} مجاز نیست`,
      );
    }

    const shouldRestoreStock =
      dto.status === OrderStatus.CANCELLED &&
      existing.status !== OrderStatus.CANCELLED;

    const verifiedAt =
      dto.status === OrderStatus.PAID
        ? existing.verifiedAt ?? new Date()
        : existing.verifiedAt;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (shouldRestoreStock) {
        for (const item of existing.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      return tx.order.update({
        where: { id },
        data: {
          status: dto.status,
          adminNotes: dto.adminNotes ?? existing.adminNotes,
          trackingCode: dto.trackingCode ?? existing.trackingCode,
          verifiedAt,
        },
        include: { items: { orderBy: { id: 'asc' } } },
      });
    });

    return this.serializeOrder(updated);
  }

  private async createOrderRecord(
    dto: CreateOrderDto,
    receiptImageUrl: string,
  ): Promise<OrderWithItems> {
    const qtyByProduct = new Map<number, number>();
    for (const item of dto.items) {
      qtyByProduct.set(
        item.productId,
        (qtyByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }
    const productIds = [...qtyByProduct.keys()];

    return this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });
      if (products.length !== productIds.length) {
        throw new BadRequestException('یک یا چند محصول نامعتبر است');
      }

      const lines: {
        productId: number;
        productTitle: string;
        unitPriceRial: bigint;
        quantity: number;
        lineTotalRial: bigint;
      }[] = [];
      let totalAmountRial = 0n;

      for (const product of products) {
        const quantity = qtyByProduct.get(product.id) ?? 0;
        if (!product.isActive) {
          throw new BadRequestException(`محصول «${product.name}» فعال نیست`);
        }
        if (quantity < 1) {
          throw new BadRequestException('تعداد نامعتبر است');
        }
        if (product.stock < quantity) {
          throw new BadRequestException(
            `موجودی «${product.name}» کافی نیست (موجود: ${product.stock})`,
          );
        }

        const unitPriceRial = product.priceRial;
        const lineTotalRial = unitPriceRial * BigInt(quantity);
        totalAmountRial += lineTotalRial;
        lines.push({
          productId: product.id,
          productTitle: product.name,
          unitPriceRial,
          quantity,
          lineTotalRial,
        });
      }

      if (totalAmountRial <= 0n) {
        throw new BadRequestException('مبلغ سفارش باید بیشتر از صفر باشد');
      }

      for (const line of lines) {
        const updated = await tx.product.updateMany({
          where: {
            id: line.productId,
            isActive: true,
            stock: { gte: line.quantity },
          },
          data: { stock: { decrement: line.quantity } },
        });
        if (updated.count !== 1) {
          throw new BadRequestException(
            `موجودی «${line.productTitle}» در لحظه ثبت کافی نبود`,
          );
        }
      }

      let order: OrderWithItems | null = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const orderNumber = this.generateOrderNumber();
        try {
          order = await tx.order.create({
            data: {
              orderNumber,
              customerName: dto.customerName.trim(),
              customerPhone: dto.customerPhone,
              customerAddress: dto.customerAddress?.trim() || null,
              customerNotes: dto.customerNotes?.trim() || null,
              totalAmountRial,
              receiptImageUrl,
              items: { create: lines },
            },
            include: { items: { orderBy: { id: 'asc' } } },
          });
          break;
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002' &&
            attempt < 4
          ) {
            continue;
          }
          throw error;
        }
      }

      if (!order) {
        throw new BadRequestException('ثبت شماره سفارش ناموفق بود');
      }
      return order;
    });
  }

  private generateOrderNumber(): string {
    const tail = Date.now().toString().slice(-6);
    const rand = randomInt(10, 100).toString();
    return `ORD-${tail}${rand}`;
  }

  private serializeOrder(order: OrderWithItems) {
    return {
      ...order,
      totalAmountRial: order.totalAmountRial.toString(),
      items: order.items.map((item) => ({
        ...item,
        unitPriceRial: item.unitPriceRial.toString(),
        lineTotalRial: item.lineTotalRial.toString(),
      })),
    };
  }

  private async notifyAdmins(order: OrderWithItems): Promise<void> {
    const toman = (order.totalAmountRial / 10n).toString();
    const message = `سفارش جدید ${order.orderNumber} به مبلغ ${toman} تومان ثبت شد.`;
    const payload = {
      type: 'NEW_ORDER',
      title: 'سفارش جدید فروشگاه',
      message,
      orderId: order.id,
    };

    try {
      this.notificationsGateway.sendToRole('ADMIN', payload);
    } catch (err: any) {
      this.logger.warn(`Socket notify failed: ${err?.message || 'unknown'}`);
    }

    const adminPhone =
      this.configService.get<string>('SHOP_ORDER_ADMIN_PHONE')?.trim() ||
      SMS_ALWAYS_CC_PHONES[0];

    await this.smsOutbound.sendIfAllowed({
      eventKey: SMS_EVENT_KEYS.SHOP_ORDER_CREATED,
      phone: adminPhone,
      message: `دوکارد فروشگاه\n${message}\n${order.customerName} ${order.customerPhone}`,
      dedupeKey: `shop.orderCreated:${order.id}`,
      templateKey: SMS_TEMPLATE_KEYS.SHOP_ORDER_ADMIN,
    });
  }

  private unlinkReceipt(url: string) {
    try {
      if (!RECEIPT_URL.test(url)) return;
      const name = url.replace('/uploads/receipts/', '');
      const abs = join(RECEIPT_UPLOAD_DIR, name);
      if (existsSync(abs)) unlinkSync(abs);
    } catch {
      this.logger.warn(`Could not remove receipt file ${url}`);
    }
  }
}
