import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import {
  NotificationPayload,
  PushNotificationsService,
} from '../push-notifications/push-notifications.service';

export type TipAlertAllocation = {
  employeeId: number;
  amountRial: bigint | number;
};

export type TipAlertParams = {
  /** Unique tip source id for idempotency (appointment id or tipSource id). */
  sourceKey: string;
  sourceLabel: string;
  customerName?: string | null;
  barberName?: string | null;
  allocations: TipAlertAllocation[];
};

/** Consecutive all-device push failures before tip pushes are skipped for the cooldown window. */
export const TIP_PUSH_BREAKER_THRESHOLD = 5;
export const TIP_PUSH_BREAKER_COOLDOWN_MS = 60_000;

/**
 * Post-commit tip alerts (in-app + Socket.IO + push). SMS is intentionally not sent.
 * Recipients are processed in parallel and push delivery is never awaited, so a slow
 * push provider (PUSH_HTTP_TIMEOUT_MS per device) cannot hold the caller's HTTP response.
 */
@Injectable()
export class TipAlertService {
  private readonly logger = new Logger(TipAlertService.name);
  private consecutivePushFailures = 0;
  private pushBreakerOpenUntil = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  async notifyTipRecipients(params: TipAlertParams): Promise<void> {
    try {
      if (!params.allocations?.length) return;

      const employeeIds = [...new Set(params.allocations.map((a) => a.employeeId))];
      const employees = await this.prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      });
      const byId = new Map(employees.map((e) => [e.id, e]));

      const customerName = (params.customerName || '—').trim();
      const barberName = (params.barberName || '—').trim();

      await Promise.allSettled(
        params.allocations.map(async (row) => {
          const emp = byId.get(row.employeeId);
          if (!emp?.userId && !emp?.user?.id) return;
          const userId = emp.user?.id ?? emp.userId;
          const amountToman = Math.floor(Number(row.amountRial) / 10);
          const amountLabel = amountToman.toLocaleString('fa-IR');
          const dedupeBase = `tip.alert:${params.sourceKey}:emp:${row.employeeId}`;

          const title = 'انعام جدید';
          const inAppMessage = `انعام ${amountLabel} تومان — مشتری: ${customerName} — آرایشگر: ${barberName} — منبع: ${params.sourceLabel}`;

          try {
            const existingNotif = await this.prisma.notification.findFirst({
              where: { relatedEntity: dedupeBase, userIdTarget: userId },
            });
            if (existingNotif) return;
            const notification = await this.notifications.create({
              title,
              message: inAppMessage,
              type: NotificationType.TIP_RECEIVED,
              userIdTarget: userId,
              relatedEntity: dedupeBase,
            });
            this.notificationsGateway.sendToUser(userId, notification);
            this.dispatchPush(row.employeeId, userId, {
              title,
              body: inAppMessage,
              icon: '/logo/doocard-icon-512.png',
              data: { url: '/dashboard/employee/salary-request', relatedEntity: dedupeBase },
            });
          } catch (err: any) {
            this.logger.warn(
              `Tip in-app notify failed emp=${row.employeeId}: ${err?.message || 'unknown'}`,
            );
          }
        }),
      );
    } catch (err: any) {
      this.logger.error(
        `TipAlertService.notifyTipRecipients failed: ${err?.message || 'unknown'}`,
      );
    }
  }

  isPushBreakerOpen(now = Date.now()): boolean {
    return now < this.pushBreakerOpenUntil;
  }

  /** Starts push delivery without awaiting it; failures only feed the breaker and the log. */
  private dispatchPush(employeeId: number, userId: number, payload: NotificationPayload): void {
    if (this.isPushBreakerOpen()) {
      this.logger.warn(`Tip push skipped emp=${employeeId}: breaker open`);
      return;
    }
    let pending: Promise<{ sent: number; failed: number } | undefined>;
    try {
      pending = Promise.resolve(this.pushNotifications.sendToUser(userId, payload));
    } catch (err) {
      pending = Promise.reject(err);
    }
    pending
      .then((res) => {
        if (res && res.sent === 0 && res.failed > 0) {
          this.recordPushFailure();
        } else if (res && res.sent > 0) {
          this.consecutivePushFailures = 0;
        }
      })
      .catch((err: any) => {
        this.recordPushFailure();
        this.logger.warn(`Tip push failed emp=${employeeId}: ${err?.message || 'unknown'}`);
      });
  }

  private recordPushFailure(): void {
    this.consecutivePushFailures += 1;
    if (this.consecutivePushFailures >= TIP_PUSH_BREAKER_THRESHOLD) {
      this.pushBreakerOpenUntil = Date.now() + TIP_PUSH_BREAKER_COOLDOWN_MS;
      this.consecutivePushFailures = 0;
      this.logger.warn(
        `Tip push breaker open for ${TIP_PUSH_BREAKER_COOLDOWN_MS}ms after ${TIP_PUSH_BREAKER_THRESHOLD} consecutive failures`,
      );
    }
  }
}
