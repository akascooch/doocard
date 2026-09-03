import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'خطای داخلی سرور';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
        message = Array.isArray(exceptionResponse.message) 
          ? exceptionResponse.message[0] 
          : exceptionResponse.message;
      }
    } else if (exception instanceof Error) {
      // مدیریت خطاهای Prisma
      if (exception.message.includes('Foreign key constraint violated')) {
        status = HttpStatus.BAD_REQUEST;
        message = 'این رکورد دارای وابستگی‌های دیگر است و قابل حذف نیست';
      } else if (exception.message.includes('Record to delete does not exist')) {
        status = HttpStatus.NOT_FOUND;
        message = 'رکورد مورد نظر یافت نشد';
      } else if (exception.message.includes('Unique constraint failed')) {
        status = HttpStatus.CONFLICT;
        message = 'این رکورد قبلاً وجود دارد';
      } else {
        message = exception.message || 'خطای نامشخص';
      }
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
      error: exception instanceof Error ? exception.name : 'UnknownError',
    };

    response.status(status).json(errorResponse);
  }
} 