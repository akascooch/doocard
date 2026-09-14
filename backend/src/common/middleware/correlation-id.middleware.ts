import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Get correlation ID from header or generate new one
    const headerId =
      firstHeader(req.headers['x-correlation-id']) ||
      firstHeader(req.headers['x-request-id']);
    const correlationId = headerId || this.generateId();

    // Attach to request
    (req as any).correlationId = correlationId;

    // Set in response header
    res.setHeader('X-Correlation-Id', correlationId);
    res.setHeader('X-Request-Id', correlationId);

    next();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

function firstHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  return String(value ?? '').trim();
}

