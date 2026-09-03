import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SKIP_RESPONSE_TIME_KEY } from '../decorators/skip-response-time.decorator';

@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_TIME_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const path: string = request?.url || request?.path || request?.originalUrl || '';

    // Streamed/file backup routes must not touch headers or tap the observable.
    if (skip || path.includes('/settings/backup')) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        if (!response.headersSent && !response.writableEnded) {
          response.setHeader('X-Response-Time', `${responseTime}ms`);
        }

        if (responseTime > 1000) {
          console.warn(`⚠️ Slow request: ${request.method} ${request.url} - ${responseTime}ms`);
        }
      }),
    );
  }
}

