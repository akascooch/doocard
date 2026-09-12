import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockWaitlistChannel, StockWaitlistStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeIranMobile } from '../common/utils/phone.util';
import { CreateWaitlistDto } from './dto/create-waitlist.dto';
import {
  PHONE_REQUIRED,
  PHONE_REQUIRED_FA,
  productInStockException,
  serializeWaitlist,
  waitlistActorUserId,
  waitlistNotFoundException,
  type WaitlistActor,
} from './waitlist.util';

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(dto: CreateWaitlistDto, actor: WaitlistActor) {
    const userId = waitlistActorUserId(actor);
    const channel = dto.channel ?? StockWaitlistChannel.SMS;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true },
      });
      if (!user) {
        throw new NotFoundException('حساب کاربری یافت نشد');
      }
      const phone = normalizeIranMobile(user.phone);
      if (!phone) {
        throw new BadRequestException({
          statusCode: 400,
          error: PHONE_REQUIRED,
          message: PHONE_REQUIRED_FA,
        });
      }

      await tx.$queryRaw`SELECT id FROM "products" WHERE id = ${dto.productId} FOR UPDATE`;
      const product = await tx.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, isActive: true, stock: true },
      });
      if (!product || !product.isActive) {
        throw new NotFoundException('محصول یافت نشد');
      }
      if (product.stock > 0) {
        throw productInStockException();
      }

      const existing = await tx.productStockSubscription.findFirst({
        where: {
          productId: product.id,
          userId,
          status: StockWaitlistStatus.ACTIVE,
        },
      });
      if (existing) {
        return serializeWaitlist(existing);
      }

      try {
        const created = await tx.productStockSubscription.create({
          data: {
            productId: product.id,
            userId,
            phone,
            channel,
            status: StockWaitlistStatus.ACTIVE,
          },
        });
        return serializeWaitlist(created);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const raced = await tx.productStockSubscription.findFirst({
            where: {
              productId: product.id,
              userId,
              status: StockWaitlistStatus.ACTIVE,
            },
          });
          if (raced) {
            return serializeWaitlist(raced);
          }
        }
        throw error;
      }
    });
  }

  async listMine(actor: WaitlistActor) {
    const userId = waitlistActorUserId(actor);
    const rows = await this.prisma.productStockSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return { items: rows.map(serializeWaitlist) };
  }

  async cancel(id: string, actor: WaitlistActor) {
    const userId = waitlistActorUserId(actor);
    const existing = await this.prisma.productStockSubscription.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw waitlistNotFoundException();
    }
    if (existing.status === StockWaitlistStatus.CANCELLED) {
      return serializeWaitlist(existing);
    }
    const updated = await this.prisma.productStockSubscription.update({
      where: { id: existing.id },
      data: {
        status: StockWaitlistStatus.CANCELLED,
        cancelledAt: existing.cancelledAt ?? new Date(),
      },
    });
    return serializeWaitlist(updated);
  }
}
