interface ErrorResponse {
  response?: {
    data?: {
      message?: string;
      error?: string;
      statusCode?: number;
    };
    status?: number;
  };
  message?: string;
}

export function getErrorMessage(error: ErrorResponse): string {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  if (error.message) {
    return error.message;
  }

  return 'خطای ناشناخته رخ داده است';
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