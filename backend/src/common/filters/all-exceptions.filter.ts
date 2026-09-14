import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { toUserFacingFaMessage } from './http-user-message';

interface StructuredError {
  status: number;
  error: string;
  message_fa: string;
  message_en: string;
  internalCode: string;
  timestamp: string;
  path: string;
  correlationId?: string;
  suggestions?: string[];
  relatedEntity?: {
    type: string;
    id?: number | string;
  };
  fieldErrors?: Record<string, string>;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (response.headersSent) {
      return;
    }

    const correlationId = resolveCorrelationId(request);
    const structuredError = this.buildStructuredError(
      exception,
      request,
      correlationId
    );

    const logPayload = {
      correlationId,
      path: request.url,
      method: request.method,
      userId: (request as any).user?.id,
      status: structuredError.status,
      internalCode: structuredError.internalCode,
    };
    const isExpectedClientOrConfig =
      structuredError.status < 500 || structuredError.status === 503;
    if (isExpectedClientOrConfig) {
      this.logger.warn(
        `[${correlationId}] ${structuredError.error}: ${structuredError.message_en}`,
        logPayload,
      );
    } else {
      this.logger.error(
        `[${correlationId}] ${structuredError.error}: ${structuredError.message_en}`,
        {
          ...logPayload,
          error: exception instanceof Error ? exception.stack : exception,
        },
      );
    }

    // Send structured response
    response.status(structuredError.status).json(structuredError);
  }

  private buildStructuredError(
    exception: unknown,
    request: Request,
    correlationId: string
  ): StructuredError {
    const timestamp = new Date().toISOString();
    const path = request.url;

    // Handle HttpException
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;

      // Extract message
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : exceptionResponse.message || exception.message;

      return {
        status,
        error: exceptionResponse.error || this.getErrorName(status),
        message_fa: toUserFacingFaMessage(message, status),
        message_en: Array.isArray(message) ? message.join(', ') : message,
        internalCode: exceptionResponse.error || `HTTP_${status}`,
        timestamp,
        path,
        correlationId,
        suggestions: this.getSuggestions(status, exceptionResponse),
        fieldErrors: exceptionResponse.fieldErrors,
      };
    }

    // Handle Prisma errors
    if (this.isPrismaError(exception)) {
      return this.handlePrismaError(exception, timestamp, path, correlationId);
    }

    // Handle generic errors
    const error = exception as Error;
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_SERVER_ERROR',
      message_fa: 'خطای سرور. لطفاً چند لحظه دیگر تکرار کنید.',
      message_en: isProduction
        ? 'Internal server error'
        : error?.message || 'Internal server error',
      internalCode: 'UNKNOWN_ERROR',
      timestamp,
      path,
      correlationId,
      suggestions: ['retry', 'contact_support'],
    };
  }

  private isPrismaError(exception: unknown): exception is Prisma.PrismaClientKnownRequestError {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof (exception as any).code === 'string' &&
      (exception as any).code.startsWith('P')
    );
  }

  private handlePrismaError(
    error: Prisma.PrismaClientKnownRequestError,
    timestamp: string,
    path: string,
    correlationId: string
  ): StructuredError {
    const code = error.code;
    const meta = error.meta;

    switch (code) {
      case 'P2002': // Unique constraint violation
        return {
          status: HttpStatus.CONFLICT,
          error: 'DUPLICATE_ENTRY',
          message_fa: `این مقدار قبلاً ثبت شده است. لطفاً مقدار دیگری انتخاب کنید.`,
          message_en: `Unique constraint failed on ${meta?.target}`,
          internalCode: 'DB_UNIQUE_VIOLATION',
          timestamp,
          path,
          correlationId,
          suggestions: ['change_value'],
        };

      case 'P2025': // Record not found
        return {
          status: HttpStatus.NOT_FOUND,
          error: 'NOT_FOUND',
          message_fa: 'رکورد مورد نظر یافت نشد.',
          message_en: 'Record not found',
          internalCode: 'DB_RECORD_NOT_FOUND',
          timestamp,
          path,
          correlationId,
          suggestions: ['refresh', 'go_back'],
        };

      case 'P2003': // Foreign key constraint
        return {
          status: HttpStatus.BAD_REQUEST,
          error: 'INVALID_REFERENCE',
          message_fa: 'ارجاع نامعتبر. آیتم مرتبط وجود ندارد.',
          message_en: 'Foreign key constraint failed',
          internalCode: 'DB_FK_VIOLATION',
          timestamp,
          path,
          correlationId,
          suggestions: ['check_related_data'],
        };

      case 'P2024': // Timeout
        return {
          status: HttpStatus.REQUEST_TIMEOUT,
          error: 'DATABASE_TIMEOUT',
          message_fa: 'عملیات طولانی شد. لطفاً دوباره تلاش کنید.',
          message_en: 'Database operation timed out',
          internalCode: 'DB_TIMEOUT',
          timestamp,
          path,
          correlationId,
          suggestions: ['retry'],
        };

      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'DATABASE_ERROR',
          message_fa: 'خطای پایگاه داده. لطفاً با پشتیبانی تماس بگیرید.',
          message_en:
            process.env.NODE_ENV === 'production'
              ? 'Database error'
              : `Database error: ${code}`,
          internalCode: `DB_${code}`,
          timestamp,
          path,
          correlationId,
          suggestions: ['contact_support'],
        };
    }
  }

  private getSuggestions(status: number, exceptionResponse: any): string[] {
    // Check if suggestions already provided
    if (exceptionResponse?.suggestions) {
      return exceptionResponse.suggestions;
    }

    // Default suggestions based on status
    switch (status) {
      case 401:
        return ['refresh', 'login'];
      case 403:
        return ['contact_admin'];
      case 404:
        return ['refresh', 'go_back'];
      case 409:
        return ['retry', 'change_data'];
      case 500:
      case 503:
        return ['retry', 'contact_support'];
      default:
        return ['retry'];
    }
  }

  private getErrorName(status: number): string {
    const names: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };

    return names[status] || 'UNKNOWN_ERROR';
  }

}

type RequestWithCorrelation = Request & { correlationId?: string };

function firstHeader(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  return String(value ?? '').trim();
}

/** Prefer middleware id, then client headers, then a fresh id. Always non-empty. */
export function resolveCorrelationId(request: Request): string {
  const req = request as RequestWithCorrelation;
  const fromMiddleware = typeof req.correlationId === 'string' ? req.correlationId.trim() : '';
  const fromCorrelationHeader = firstHeader(request.headers['x-correlation-id']);
  const fromRequestHeader = firstHeader(request.headers['x-request-id']);
  const candidate = fromMiddleware || fromCorrelationHeader || fromRequestHeader;
  if (candidate && candidate.length <= 128) {
    return candidate;
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

