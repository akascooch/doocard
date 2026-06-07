import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class ResponseTimeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const responseTime = Date.now() - startTime;
        
        // Add response time header
        response.setHeader('X-Response-Time', `${responseTime}ms`);
        
        // Log slow requests (>1s)
        if (responseTime > 1000) {
          console.warn(`⚠️ Slow request: ${request.method} ${request.url} - ${responseTime}ms`);
        }
      })
    );
  }
}

