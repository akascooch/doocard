import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Home, RefreshCw, LogOut, Mail } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  correlationId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      correlationId: this.generateCorrelationId(),
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const correlationId = this.generateCorrelationId();
    
    this.setState({
      error,
      errorInfo,
      correlationId,
    });

    // Log to console
    console.error('🔴 React Error Boundary caught an error:', {
      correlationId,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Send error to backend for logging (optional)
    this.logErrorToBackend(error, errorInfo, correlationId);
  }

  async logErrorToBackend(error: Error, errorInfo: ErrorInfo, correlationId: string) {
    try {
      // Use relative URL to respect CSP and current protocol (HTTPS)
      await fetch('/api/monitoring/client-errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          correlationId,
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (logError) {
      console.error('Failed to log error to backend:', logError);
    }
  }

  generateCorrelationId(): string {
    return `fe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      correlationId: this.generateCorrelationId(),
    });
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  handleContactSupport = () => {
    const { error, correlationId } = this.state;
    const subject = encodeURIComponent('خطای سیستم Doocard');
    const body = encodeURIComponent(`
خطای سیستم
────────────────
Correlation ID: ${correlationId}
Error: ${error?.message}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}

لطفاً این اطلاعات را حذف نکنید.
    `);
    
    window.location.href = `mailto:support@doocard.com?subject=${subject}&body=${body}`;
  };

  render() {
    if (this.state.hasError) {
      const { error, correlationId } = this.state;

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
          <Card className="max-w-2xl w-full p-8">
            <div className="text-center">
              {/* Icon */}
              <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/20 mx-auto mb-6 flex items-center justify-center">
                <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-foreground mb-3">
                متأسفیم! خطایی رخ داد
              </h1>

              {/* Description */}
              <p className="text-muted-foreground mb-2">
                یک خطای غیرمنتظره در سیستم رخ داده است.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                لطفاً یکی از گزینه‌های زیر را امتحان کنید یا با پشتیبانی تماس بگیرید.
              </p>

              {/* Error Details */}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-6 text-right">
                <p className="text-xs text-muted-foreground mb-1">
                  <span className="font-semibold">شناسه خطا (Correlation ID):</span>
                </p>
                <p className="text-sm font-mono bg-white dark:bg-gray-900 px-3 py-2 rounded border">
                  {correlationId}
                </p>
                
                {error && (
                  <>
                    <p className="text-xs text-muted-foreground mt-3 mb-1">
                      <span className="font-semibold">جزئیات:</span>
                    </p>
                    <p className="text-xs font-mono text-red-600 dark:text-red-400 bg-white dark:bg-gray-900 px-3 py-2 rounded border max-h-32 overflow-auto text-left">
                      {error.message}
                    </p>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button
                  variant="default"
                  onClick={this.handleReset}
                >
                  <RefreshCw className="w-4 h-4 ml-2" />
                  تلاش مجدد
                </Button>

                <Button variant="outline" onClick={this.handleGoHome}>
                  <Home className="w-4 h-4 ml-2" />
                  صفحه اصلی
                </Button>

                <Button variant="outline" onClick={this.handleLogout}>
                  <LogOut className="w-4 h-4 ml-2" />
                  خروج
                </Button>

                <Button variant="outline" onClick={this.handleContactSupport}>
                  <Mail className="w-4 h-4 ml-2" />
                  پشتیبانی
                </Button>
              </div>

              {/* Tip */}
              <p className="text-xs text-muted-foreground mt-6">
                💡 نکته: شناسه خطا را برای تیم پشتیبانی ذخیره کنید
              </p>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

