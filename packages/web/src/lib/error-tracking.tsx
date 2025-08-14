import React from 'react';

export interface ErrorContext {
  userId?: string;
  projectId?: string;
  storyId?: string;
  userAgent?: string;
  url?: string;
  component?: string;
  action?: string;
  [key: string]: any;
}

export type ErrorLevel = 'error' | 'warning' | 'info' | 'debug';

class ErrorTrackingService {
  private initialized = false;

  init(): void {
    if (this.initialized) {
      console.warn('Error tracking already initialized');
      return;
    }

    // Simple console-based error tracking for development
    console.log('✅ Error tracking initialized (console mode)');
    this.initialized = true;
  }

  captureException(error: Error, context?: ErrorContext): string {
    const errorId = Date.now().toString();
    
    console.error('🚨 Exception captured:', {
      id: errorId,
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
    });

    return errorId;
  }

  captureMessage(message: string, level: ErrorLevel = 'info', context?: ErrorContext): string {
    const messageId = Date.now().toString();
    
    const logMethod = level === 'error' ? console.error : 
                     level === 'warning' ? console.warn : 
                     console.log;

    logMethod(`📝 Message captured [${level.toUpperCase()}]:`, {
      id: messageId,
      message,
      context,
      timestamp: new Date().toISOString(),
    });

    return messageId;
  }

  setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.initialized) return;
    console.log('👤 User set:', user);
  }

  setContext(key: string, context: any): void {
    if (!this.initialized) return;
    console.log(`🔧 Context set [${key}]:`, context);
  }

  addBreadcrumb(message: string, category?: string, level?: ErrorLevel, data?: any): void {
    if (!this.initialized) return;
    
    console.log('🍞 Breadcrumb added:', {
      message,
      category: category || 'default',
      level: level || 'info',
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // Convenience methods for common scenarios
  captureRouteError(error: Error, route: string, userId?: string): string {
    return this.captureException(error, {
      component: 'router',
      action: 'navigation',
      url: route,
      userId,
    });
  }

  captureAPIError(error: Error, endpoint: string, method: string, statusCode?: number, userId?: string): string {
    return this.captureException(error, {
      component: 'api-client',
      action: 'api-call',
      endpoint,
      method,
      statusCode,
      userId,
    });
  }

  captureComponentError(error: Error, componentName: string, props?: any, userId?: string): string {
    return this.captureException(error, {
      component: componentName,
      action: 'render',
      props,
      userId,
    });
  }

  captureUserAction(action: string, component: string, userId?: string, data?: any): string {
    return this.captureMessage(`User action: ${action}`, 'info', {
      component,
      action,
      userId,
      data,
    });
  }

  capturePerformanceIssue(metric: string, value: number, threshold: number, context?: ErrorContext): string {
    return this.captureMessage(
      `Performance issue: ${metric} (${value}) exceeded threshold (${threshold})`,
      'warning',
      {
        ...context,
        metric,
        value,
        threshold,
        component: 'performance',
      }
    );
  }

  startTransaction(name: string, op: string): any {
    if (!this.initialized) return undefined;
    
    console.log(`🚀 Transaction started: ${name} (${op})`);
    return {
      name,
      op,
      startTime: Date.now(),
      finish: () => {
        console.log(`✅ Transaction finished: ${name} (${Date.now() - this.startTime}ms)`);
      }
    };
  }

  withErrorBoundary<T extends React.ComponentType<any>>(
    Component: T,
    options?: {
      fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
      beforeCapture?: (error: Error, errorInfo: any) => void;
    }
  ): T {
    if (!this.initialized) return Component;
    
    const WrappedComponent = (props: any) => {
      return (
        <ErrorBoundary
          fallback={options?.fallback || DefaultErrorFallback}
          onError={(error, errorInfo) => {
            this.captureException(error, { errorInfo });
            options?.beforeCapture?.(error, errorInfo);
          }}
        >
          <Component {...props} />
        </ErrorBoundary>
      );
    };

    return WrappedComponent as T;
  }
}

// Simple Error Boundary component
class ErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    fallback: React.ComponentType<{ error: Error; resetError: () => void }>;
    onError?: (error: Error, errorInfo: any) => void;
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const Fallback = this.props.fallback;
      return (
        <Fallback
          error={this.state.error}
          resetError={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}

// Default error fallback component
function DefaultErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0">
            <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-gray-900">Something went wrong</h3>
          </div>
        </div>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            We're sorry, but something unexpected happened. The error has been reported and we'll look into it.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4">
              <summary className="text-sm text-gray-500 cursor-pointer">Error details (development only)</summary>
              <pre className="mt-2 text-xs text-gray-400 bg-gray-100 p-2 rounded overflow-auto">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={resetError}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}

// Create singleton instance
export const errorTracking = new ErrorTrackingService();

// React hook for error tracking
export function useErrorTracking() {
  const captureException = (error: Error, context?: ErrorContext) => {
    return errorTracking.captureException(error, context);
  };

  const captureMessage = (message: string, level?: ErrorLevel, context?: ErrorContext) => {
    return errorTracking.captureMessage(message, level, context);
  };

  const addBreadcrumb = (message: string, category?: string, level?: ErrorLevel, data?: any) => {
    errorTracking.addBreadcrumb(message, category, level, data);
  };

  return {
    captureException,
    captureMessage,
    addBreadcrumb,
  };
}

// Higher-order component for error boundaries
export function withErrorTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) {
  const WithErrorTrackingComponent = (props: P) => {
    return errorTracking.withErrorBoundary(WrappedComponent, {
      beforeCapture: (error, errorInfo) => {
        console.log(`Error in component: ${componentName || WrappedComponent.name}`, {
          error,
          errorInfo,
          props,
        });
      },
    })(props);
  };

  WithErrorTrackingComponent.displayName = `withErrorTracking(${componentName || WrappedComponent.name})`;
  
  return WithErrorTrackingComponent;
}