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

    const correlationId = request.headers['x-request-id'] as string || this.generateId();
    const structuredError = this.buildStructuredError(
      exception,
      request,
      correlationId
    );

    // Log error with context
    this.logger.error(
      `[${correlationId}] ${structuredError.error}: ${structuredError.message_en}`,
      {
        correlationId,
        path: request.url,
        method: request.method,
        userId: (request as any).user?.id,
        error: exception instanceof Error ? exception.stack : exception,
      }
    );

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
        message_fa: this.translateMessage(message, status),
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

  private translateMessage(message: string | string[], status: number): string {
    const msg = Array.isArray(message) ? message[0] : message;

    // Common error translations
    const translations: Record<string, string> = {
      'Unauthorized': 'دسترسی غیرمجاز. لطفاً وارد شوید.',
      'Forbidden': 'شما مجاز به انجام این عملیات نیستید.',
      'Not Found': 'موردی یافت نشد.',
      'Bad Request': 'درخواست نامعتبر.',
      'Conflict': 'تداخل در داده‌ها.',
      'Internal Server Error': 'خطای داخلی سرور.',
      'Service Unavailable': 'سرویس در دسترس نیست.',
      'Too Many Requests': 'تعداد درخواست‌ها بیش از حد مجاز است.',
      'Validation failed': 'اعتبارسنجی ناموفق بود.',
      'Customer not found': 'مشتری یافت نشد.',
      'Employee not found': 'آرایشگر یافت نشد.',
      'Appointment not found': 'نوبت یافت نشد.',
      'Session expired': 'نشست شما منقضی شده است.',
    };

    // Try exact match
    if (translations[msg]) {
      return translations[msg];
    }

    // Try partial match
    for (const [key, value] of Object.entries(translations)) {
      if (msg.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }

    // Fallback
    switch (status) {
      case 400:
        return 'درخواست نامعتبر. لطفاً ورودی‌ها را بررسی کنید.';
      case 401:
        return 'نشست شما منقضی شده. لطفاً دوباره وارد شوید.';
      case 403:
        return 'شما مجاز به انجام این عملیات نیستید.';
      case 404:
        return 'موردی یافت نشد.';
      case 409:
        return 'تداخل در داده‌ها. لطفاً دوباره تلاش کنید.';
      case 500:
        return 'خطای سرور. لطفاً چند لحظه دیگر تکرار کنید.';
      case 503:
        return 'سرویس موقتاً در دسترس نیست.';
      default:
        return msg || 'خطای ناشناخته';
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

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

