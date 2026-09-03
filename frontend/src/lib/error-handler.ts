interface ErrorResponse {
  response?: {
    data?: {
      message?: string;
      message_fa?: string;
      error?: string;
      statusCode?: number;
    };
    status?: number;
  };
  message?: string;
  friendlyMessage?: string; // Added from axios interceptor
}

export function getErrorMessage(error: ErrorResponse): string {
  // بررسی پیام دوستانه از axios interceptor (اولویت اول)
  if (error.friendlyMessage) {
    return error.friendlyMessage;
  }

  // بررسی پیام فارسی از backend
  if (error.response?.data?.message_fa) {
    return error.response.data.message_fa;
  }

  // بررسی خطاهای HTTP
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  // بررسی کدهای خطای HTTP
  if (error.response?.status) {
    switch (error.response.status) {
      case 400:
        return 'اطلاعات ارسالی نامعتبر است. لطفاً ورودی‌ها را بررسی کنید.';
      case 401:
        return 'نام کاربری یا رمز عبور اشتباه است.';
      case 403:
        return 'شما مجوز دسترسی به این بخش را ندارید.';
      case 404:
        return 'اطلاعات مورد نظر یافت نشد.';
      case 409:
        return 'این اطلاعات قبلاً ثبت شده است.';
      case 422:
        return 'اطلاعات ورودی نامعتبر است.';
      case 500:
        return 'خطا در سرور. لطفاً بعداً دوباره تلاش کنید.';
      default:
        return `خطای ${error.response.status} رخ داده است.`;
    }
  }

  if (error.message) {
    return error.message;
  }

  return 'خطای غیرمنتظره‌ای رخ داده است.';
}

export function logError(error: ErrorResponse, context: string): void {
  console.group(`🔴 Error in ${context}`);
  console.error('Error details:', {
    message: error.message,
    response: error.response?.data,
    status: error.response?.status,
  });
  if (error.response?.data) {
    console.error('Server response:', error.response.data);
  }
  console.groupEnd();
} 