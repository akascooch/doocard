import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LOYALTY_MIN_REDEEM_POINTS, LOYALTY_RIALS_PER_POINT } from '../packages/packages.constants';
import { AdjustLoyaltyDto, RedeemLoyaltyDto, UpdateLoyaltySettingsDto } from './dto/loyalty.dto';

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: number) {
    const customer = await this.requireCustomerByUserId(userId);
    return this.snapshot(customer.id);
  }

  async snapshot(customerId: number) {
    const config = await this.readLoyaltyConfig();
    const [pointsSum, walletSum] = await Promise.all([
      this.prisma.loyaltyPointTransaction.aggregate({
        where: { customerId },
        _sum: { points: true },
      }),
      this.prisma.customerWalletLedger.aggregate({
        where: { customerId },
        _sum: { amount: true },
      }),
    ]);
    const points = pointsSum._sum.points ?? 0;
    const walletRial = walletSum._sum.amount ?? 0n;
    return {
      customerId,
      points,
      walletRial: walletRial.toString(),
      minRedeemPoints: config.minRedeemPoints,
      rialsPerPoint: config.rialsPerPoint,
      redeemable: points >= config.minRedeemPoints,
      previewRial:
        points >= config.minRedeemPoints
          ? String(BigInt(points) * BigInt(config.rialsPerPoint))
          : '0',
    };
  }

  async redeemToWallet(userId: number, dto: RedeemLoyaltyDto) {
    const customer = await this.requireCustomerByUserId(userId);
    const config = await this.readLoyaltyConfig();
    if (dto.points < config.minRedeemPoints) {
      throw new BadRequestException(`حداقل امتیاز قابل تبدیل ${config.minRedeemPoints} است`);
    }
    const credit = BigInt(dto.points) * BigInt(config.rialsPerPoint);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM customers WHERE id = ${customer.id} FOR UPDATE`;
      const sum = await tx.loyaltyPointTransaction.aggregate({
        where: { customerId: customer.id },
        _sum: { points: true },
      });
      const balance = sum._sum.points ?? 0;
      if (balance < dto.points) {
        throw new BadRequestException('امتیاز کافی نیست');
      }
      const loyalty = await tx.loyaltyPointTransaction.create({
        data: {
          customerId: customer.id,
          points: -dto.points,
          action: 'REDEEMED_WALLET',
          notes: `تبدیل ${dto.points} امتیاز`,
        },
      });
      await tx.customerWalletLedger.create({
        data: {
          customerId: customer.id,
          amount: credit,
          type: 'CREDIT',
          source: 'LOYALTY_REDEEM',
          referenceId: loyalty.id,
        },
      });
      const after = await tx.loyaltyPointTransaction.aggregate({
        where: { customerId: customer.id },
        _sum: { points: true },
      });
      const wallet = await tx.customerWalletLedger.aggregate({
        where: { customerId: customer.id },
        _sum: { amount: true },
      });
      return {
        points: after._sum.points ?? 0,
        walletRial: (wallet._sum.amount ?? 0n).toString(),
        redeemedPoints: dto.points,
        creditedRial: credit.toString(),
      };
    });
  }

  async adjustPoints(dto: AdjustLoyaltyDto) {
    if (dto.points === 0) {
      throw new BadRequestException('مقدار امتیاز نمی‌تواند صفر باشد');
    }
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException('مشتری یافت نشد');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM customers WHERE id = ${customer.id} FOR UPDATE`;
      if (dto.points < 0) {
        const sum = await tx.loyaltyPointTransaction.aggregate({
          where: { customerId: customer.id },
          _sum: { points: true },
        });
        const balance = sum._sum.points ?? 0;
        if (balance + dto.points < 0) {
          throw new BadRequestException('امتیاز مشتری برای این کاهش کافی نیست');
        }
      }
      const row = await tx.loyaltyPointTransaction.create({
        data: {
          customerId: customer.id,
          points: dto.points,
          action: 'ADMIN_ADJUSTMENT',
          notes: dto.notes.trim(),
        },
      });
      const after = await tx.loyaltyPointTransaction.aggregate({
        where: { customerId: customer.id },
        _sum: { points: true },
      });
      return { id: row.id, points: after._sum.points ?? 0, delta: dto.points };
    });
  }

  async getLoyaltySettings() {
    return this.readLoyaltyConfig();
  }

  async updateLoyaltySettings(dto: UpdateLoyaltySettingsDto) {
    if (dto.loyaltyRateRialPerPoint === undefined && dto.loyaltyMinRedeemPoints === undefined) {
      throw new BadRequestException('حداقل یک مقدار تنظیمات لازم است');
    }
    const row = await this.prisma.systemSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        loyaltyRateRialPerPoint: dto.loyaltyRateRialPerPoint ?? LOYALTY_RIALS_PER_POINT,
        loyaltyMinRedeemPoints: dto.loyaltyMinRedeemPoints ?? LOYALTY_MIN_REDEEM_POINTS,
      },
      update: {
        ...(dto.loyaltyRateRialPerPoint !== undefined
          ? { loyaltyRateRialPerPoint: dto.loyaltyRateRialPerPoint }
          : {}),
        ...(dto.loyaltyMinRedeemPoints !== undefined
          ? { loyaltyMinRedeemPoints: dto.loyaltyMinRedeemPoints }
          : {}),
      },
    });
    return this.normalizeConfig(row.loyaltyRateRialPerPoint, row.loyaltyMinRedeemPoints);
  }

  async readLoyaltyConfig() {
    try {
      const row = await this.prisma.systemSettings.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {},
      });
      return this.normalizeConfig(row.loyaltyRateRialPerPoint, row.loyaltyMinRedeemPoints);
    } catch {
      return this.normalizeConfig(LOYALTY_RIALS_PER_POINT, LOYALTY_MIN_REDEEM_POINTS);
    }
  }

  private normalizeConfig(rate: number | null | undefined, min: number | null | undefined) {
    const rialsPerPoint =
      typeof rate === 'number' && rate >= 1 && rate <= 1_000_000 ? rate : LOYALTY_RIALS_PER_POINT;
    const minRedeemPoints =
      typeof min === 'number' && min >= 1 && min <= 100_000 ? min : LOYALTY_MIN_REDEEM_POINTS;
    return { rialsPerPoint, minRedeemPoints };
  }

  private async requireCustomerByUserId(userId: number) {
    const customer = await this.prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new NotFoundException('پروفایل مشتری یافت نشد');
    return customer;
  }
}
