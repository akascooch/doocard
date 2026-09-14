import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Logger } from '@nestjs/common';
import { ReportClientErrorDto } from './dto/report-client-error.dto';
import { MonitoringService } from './monitoring.service';

const SECRET_FRAGMENT =
  /(authorization\s*[:=]\s*)\S+|(bearer\s+)[a-z0-9._\-+=/]+|(token\s*[=:]\s*)[^\s&]+|(password\s*[=:]\s*)[^\s&]+|(cookie\s*[:=]\s*)[^\s;]+/gi;

export function sanitizeClientErrorText(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const redacted = value.replace(SECRET_FRAGMENT, '[REDACTED]');
  return redacted.slice(0, max);
}

@Controller('monitoring')
export class ClientErrorsController {
  private readonly logger = new Logger(ClientErrorsController.name);

  constructor(private readonly monitoring: MonitoringService) {}

  @Post('client-errors')
  @UseGuards(ThrottlerGuard)
  @Throttle({ short: { limit: 8, ttl: 60_000 } })
  report(@Body() dto: ReportClientErrorDto, @Req() req: { correlationId?: string; ip?: string }) {
    const correlationId =
      sanitizeClientErrorText(dto.correlationId, 128) ||
      (typeof req.correlationId === 'string' ? req.correlationId.slice(0, 128) : 'unknown');
    this.logger.warn(
      `[client-error][${correlationId}] ${sanitizeClientErrorText(dto.message, 500) || 'unnamed'}`,
      {
        correlationId,
        url: sanitizeClientErrorText(dto.url, 500),
        ip: typeof req.ip === 'string' ? req.ip.slice(0, 64) : undefined,
        stack: sanitizeClientErrorText(dto.stack, 2000),
        componentStack: sanitizeClientErrorText(dto.componentStack, 2000),
      },
    );
    this.monitoring.recordClientError();
    return { ok: true, correlationId };
  }
}
