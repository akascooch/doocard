'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw, Home } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error?: Error; resetError: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined })
    // Clear any problematic router state
    if (typeof window !== 'undefined') {
      // Clear session storage that might contain corrupted router state
      try {
        sessionStorage.removeItem('__next_router_state')
        sessionStorage.removeItem('__next_router_prefetch')
        localStorage.removeItem('__next_router_state')
        localStorage.removeItem('__next_router_prefetch')
      } catch (e) {
        console.log('Could not clear router state:', e)
      }
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <RefreshCw className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-xl text-foreground">خطا در بارگذاری صفحه</CardTitle>
              <CardDescription>
                مشکلی در بارگذاری صفحه رخ داده است. لطفاً دوباره تلاش کنید.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground font-mono">
                    {this.state.error.message}
                  </p>
                </div>
              )}
              <div className="flex flex-col space-y-2">
                <Button onClick={this.resetError} className="w-full">
                  <RefreshCw className="ml-2 h-4 w-4" />
                  تلاش مجدد
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/'}
                  className="w-full"
                >
                  <Home className="ml-2 h-4 w-4" />
                  بازگشت به صفحه اصلی
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook version for functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  const resetError = React.useCallback(() => {
    setError(null)
    // Clear router state
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('__next_router_state')
        sessionStorage.removeItem('__next_router_prefetch')
        localStorage.removeItem('__next_router_state')
        localStorage.removeItem('__next_router_prefetch')
      } catch (e) {
        console.log('Could not clear router state:', e)
      }
    }
  }, [])

  const handleError = React.useCallback((error: Error) => {
    setError(error)
  }, [])

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return { handleError, resetError }
}
