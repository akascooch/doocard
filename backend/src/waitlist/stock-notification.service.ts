import { Injectable, Logger } from '@nestjs/common';
import { StockWaitlistChannel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { SmsOutboundService } from '../sms/sms-outbound.service';
import { SmsTemplateService } from '../sms/sms-template.service';
import { SMS_EVENT_KEYS } from '../sms/sms-event-keys';
import { SMS_TEMPLATE_KEYS } from '../sms/sms-template.catalog';
import { normalizeIranMobile } from '../common/utils/phone.util';
import {
  backInStockTransitions,
  type StockTransition,
} from './stock-transition.util';

type ClaimedSubscription = {
  id: string;
  userId: number;
  phone: string;
  channel: StockWaitlistChannel | string;
};

const DISPATCH_CHUNK = 5;

@Injectable()
export class StockNotificationService {
  private readonly logger = new Logger(StockNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsOutbound: SmsOutboundService,
    private readonly smsTemplates: SmsTemplateService,
    private readonly notifications: NotificationsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  notifyIfBackInStock(productId: number, previousStock: number, nextStock: number): void {
    this.scheduleBackInStock([{ productId, previousStock, nextStock }]);
  }

  scheduleBackInStock(transitions: StockTransition[]): void {
    const due = backInStockTransitions(transitions);
    for (const row of due) {
      void this.dispatch(row.productId).catch((err: any) => {
        this.logger.warn(
          `Back-in-stock dispatch failed product=${row.productId}: ${err?.message || 'unknown'}`,
        );
      });
    }
  }

  async dispatch(productId: number): Promise<void> {
    const claimed = await this.claimActiveSubscribers(productId);
    if (claimed.length === 0) {
      return;
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { name: true },
    });
    const productName = product?.name?.trim() || 'کالا';
    const message = await this.buildMessage(productName);

    for (let i = 0; i < claimed.length; i += DISPATCH_CHUNK) {
      const chunk = claimed.slice(i, i + DISPATCH_CHUNK);
      await Promise.allSettled(chunk.map((row) => this.notifyOne(row, productId, productName, message)));
    }
  }

  async claimActiveSubscribers(productId: number): Promise<ClaimedSubscription[]> {
    return this.prisma.$queryRaw<ClaimedSubscription[]>`
      UPDATE "product_stock_subscriptions"
      SET
        status = 'NOTIFIED'::"StockWaitlistStatus",
        "notifiedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "productId" = ${productId}
        AND status = 'ACTIVE'::"StockWaitlistStatus"
      RETURNING id, "userId", phone, channel
    `;
  }

  private async buildMessage(productName: string): Promise<string> {
    const fallback = `مشتری گرامی دوکارد، محصول ${productName} مجدداً موجود شد.`;
    try {
      return await this.smsTemplates.renderByKey(
        SMS_TEMPLATE_KEYS.PRODUCT_BACK_IN_STOCK,
        { productName },
        fallback,
      );
    } catch (err: any) {
      this.logger.warn(`Waitlist SMS template render failed: ${err?.message || 'unknown'}`);
      return fallback;
    }
  }

  private async notifyOne(
    row: ClaimedSubscription,
    productId: number,
    productName: string,
    message: string,
  ): Promise<void> {
    try {
      const notification = await this.notifications.create({
        title: 'موجود شد',
        message,
        type: 'GENERAL',
        userIdTarget: row.userId,
        relatedEntity: `product:${productId}`,
      });
      try {
        this.gateway.sendToUser(row.userId, notification);
      } catch (err: any) {
        this.logger.warn(
          `Back-in-stock in-app socket failed subscription=${row.id}: ${err?.message || 'unknown'}`,
        );
      }
    } catch (err: any) {
      this.logger.warn(
        `Back-in-stock in-app create failed subscription=${row.id}: ${err?.message || 'unknown'}`,
      );
    }

    if (row.channel === StockWaitlistChannel.IN_APP) {
      return;
    }

    const phone = normalizeIranMobile(row.phone);
    if (!phone) {
      this.logger.warn(`Back-in-stock SMS skipped subscription=${row.id}: missing phone`);
      return;
    }

    try {
      await this.smsOutbound.sendIfAllowed({
        eventKey: SMS_EVENT_KEYS.PRODUCT_BACK_IN_STOCK,
        phone,
        message,
        dedupeKey: `${SMS_EVENT_KEYS.PRODUCT_BACK_IN_STOCK}:${row.id}`,
        templateKey: SMS_TEMPLATE_KEYS.PRODUCT_BACK_IN_STOCK,
        skipAlwaysCc: true,
      });
    } catch (err: any) {
      this.logger.warn(
        `Back-in-stock SMS failed subscription=${row.id} product=${productId}: ${err?.message || 'unknown'}`,
      );
    }
  }
}
