import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_SMS_TEMPLATES,
  SMS_TEMPLATE_KEYS,
  SmsTemplateKey,
} from './sms-template.catalog';

@Injectable()
export class SmsTemplateService implements OnModuleInit {
  private readonly logger = new Logger(SmsTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureDefaults();
    } catch (err: any) {
      this.logger.warn(
        `SMS template seed skipped: ${err?.message || 'unknown'}`,
      );
    }
  }

  async ensureDefaults(): Promise<void> {
    for (const seed of DEFAULT_SMS_TEMPLATES) {
      const existing = await this.prisma.smsTemplate.findFirst({
        where: { name: seed.name },
      });
      if (!existing) {
        await this.prisma.smsTemplate.create({
          data: {
            name: seed.name,
            content: seed.content,
            description: seed.description,
            variables: seed.variables,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      } else if (
        seed.name === SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER &&
        !existing.content.includes('{bankName}')
      ) {
        await this.prisma.smsTemplate.update({
          where: { id: existing.id },
          data: {
            content: seed.content,
            description: seed.description,
            variables: seed.variables,
            updatedAt: new Date(),
          },
        });
      } else if (!existing.description) {
        // Backfill description only — never touches content or triggers send.
        await this.prisma.smsTemplate.update({
          where: { id: existing.id },
          data: { description: seed.description, updatedAt: new Date() },
        });
      }
    }
  }

  async list(params?: { q?: string; includeInactive?: boolean }) {
    await this.ensureDefaults();
    const q = (params?.q || '').trim();
    const rows = await this.prisma.smsTemplate.findMany({
      where: {
        ...(params?.includeInactive ? {} : { isActive: true }),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { content: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });

    const metaByKey = new Map(
      DEFAULT_SMS_TEMPLATES.map((t) => [
        t.name,
        { label: t.label, description: t.description },
      ] as const),
    );

    return rows.map((r) => {
      const meta = metaByKey.get(r.name as SmsTemplateKey);
      return {
        id: r.id,
        templateKey: r.name,
        label: meta?.label || r.name,
        description: r.description || meta?.description || '',
        content: r.content,
        allowedVariables: r.variables || [],
        isActive: r.isActive,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        preview: this.render(r.content, this.sampleVars(r.variables || [])),
        note: 'متن آزاد اپ — شناسه قالب پنل sms.ir استفاده نمی‌شود',
      };
    });
  }

  async getByKey(templateKey: string) {
    await this.ensureDefaults();
    const row = await this.prisma.smsTemplate.findFirst({
      where: { name: templateKey },
    });
    if (!row) throw new NotFoundException(`قالب یافت نشد: ${templateKey}`);
    return row;
  }

  async renderByKey(
    templateKey: string,
    vars: Record<string, string>,
    fallback?: string,
  ): Promise<string> {
    try {
      const row = await this.prisma.smsTemplate.findFirst({
        where: { name: templateKey, isActive: true },
      });
      if (row?.content?.trim()) {
        return this.render(row.content, vars);
      }
    } catch {
      // fall through to catalog fallback (explicit, auditable)
    }
    const seed = DEFAULT_SMS_TEMPLATES.find((t) => t.name === templateKey);
    if (seed) return this.render(seed.content, vars);
    return this.render(fallback || '', vars);
  }

  async update(
    templateKey: string,
    data: {
      content?: string;
      isActive?: boolean;
      variables?: string[];
      description?: string;
    },
  ) {
    const row = await this.getByKey(templateKey);
    const content = data.content !== undefined ? data.content.trim() : row.content;
    if (!content) {
      throw new BadRequestException('متن قالب خالی مجاز نیست');
    }
    if (content.length > 1000) {
      throw new BadRequestException('متن قالب بیش از حد طولانی است');
    }
    const description =
      data.description !== undefined
        ? data.description.trim().slice(0, 500) || null
        : row.description;
    // DB-only update — callers must never invoke send after this.
    return this.prisma.smsTemplate.update({
      where: { id: row.id },
      data: {
        content,
        description,
        isActive: data.isActive ?? row.isActive,
        variables: data.variables ?? row.variables,
        updatedAt: new Date(),
      },
    });
  }

  render(content: string, vars: Record<string, string>): string {
    let out = content || '';
    for (const [k, v] of Object.entries(vars || {})) {
      out = out.split(`{${k}}`).join(v ?? '');
    }
    return out;
  }

  private sampleVars(variables: string[]): Record<string, string> {
    const samples: Record<string, string> = {
      name: 'علی',
      phone: '0912***6789',
      source: 'ثبت ادمین',
      employeeName: 'آرایشگر نمونه',
      customerName: 'مشتری نمونه',
      jalaliDate: '1404/01/01',
      time: '14:00',
      serviceNames: 'اصلاح مو',
    };
    const out: Record<string, string> = {};
    for (const v of variables) {
      out[v] = samples[v] ?? `{${v}}`;
    }
    return out;
  }

  catalogKeys() {
    return DEFAULT_SMS_TEMPLATES.map((t) => ({
      templateKey: t.name,
      label: t.label,
      description: t.description,
      allowedVariables: t.variables,
    }));
  }
}

export { SMS_TEMPLATE_KEYS };
