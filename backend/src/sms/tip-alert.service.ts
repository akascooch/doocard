import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';

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

/**
 * Post-commit tip alerts (in-app + Socket.IO + push). SMS is intentionally not sent.
 */
@Injectable()
export class TipAlertService {
  private readonly logger = new Logger(TipAlertService.name);

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

      for (const row of params.allocations) {
        const emp = byId.get(row.employeeId);
        if (!emp?.userId && !emp?.user?.id) continue;
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
          if (!existingNotif) {
            const notification = await this.notifications.create({
              title,
              message: inAppMessage,
              type: NotificationType.TIP_RECEIVED,
              userIdTarget: userId,
              relatedEntity: dedupeBase,
            });
            this.notificationsGateway.sendToUser(userId, notification);
            await this.pushNotifications.sendToUser(userId, {
              title,
              body: inAppMessage,
              icon: '/logo/logo-512.png',
              data: { url: '/dashboard/employee/salary-request', relatedEntity: dedupeBase },
            });
          }
        } catch (err: any) {
          this.logger.warn(
            `Tip in-app/push notify failed emp=${row.employeeId}: ${err?.message || 'unknown'}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(
        `TipAlertService.notifyTipRecipients failed: ${err?.message || 'unknown'}`,
      );
    }
  }
}
