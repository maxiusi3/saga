import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

export interface ErrorContext {
  userId?: string;
  projectId?: string;
  storyId?: string;
  screen?: string;
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

    const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
    if (!dsn) {
      console.warn('EXPO_PUBLIC_SENTRY_DSN not configured. Error tracking will be disabled.');
      return;
    }

    Sentry.init({
      dsn,
      environment: __DEV__ ? 'development' : 'production',
      tracesSampleRate: __DEV__ ? 1.0 : 0.1,
      debug: __DEV__,
      beforeSend: (event) => {
        // Filter out sensitive information
        if (event.request?.headers) {
          delete event.request.headers.authorization;
        }

        // Filter out development errors in production
        if (!__DEV__ && event.environment === 'development') {
          return null;
        }

        return event;
      },
      integrations: [
        new Sentry.ReactNativeTracing({
          // Tracing integrations
          routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),
        }),
      ],
    });

    this.initialized = true;
    console.log('✅ Error tracking initialized');
  }

  captureException(error: Error, context?: ErrorContext): string {
    if (!this.initialized) {
      console.error('Error tracking not initialized:', error);
      return '';
    }

    return Sentry.captureException(error, {
      tags: {
        screen: context?.screen,
        action: context?.action,
        userId: context?.userId,
        projectId: context?.projectId,
        platform: Platform.OS,
      },
      extra: {
        ...context,
        deviceInfo: {
          platform: Platform.OS,
          version: Platform.Version,
        },
      },
      user: context?.userId ? {
        id: context.userId,
      } : undefined,
    });
  }

  captureMessage(message: string, level: ErrorLevel = 'info', context?: ErrorContext): string {
    if (!this.initialized) {
      console.log(`[${level.toUpperCase()}] ${message}`, context);
      return '';
    }

    return Sentry.captureMessage(message, {
      level,
      tags: {
        screen: context?.screen,
        action: context?.action,
        userId: context?.userId,
        projectId: context?.projectId,
        platform: Platform.OS,
      },
      extra: context,
    });
  }

  setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.initialized) return;
    
    Sentry.setUser(user);
  }

  setContext(key: string, context: any): void {
    if (!this.initialized) return;
    
    Sentry.setContext(key, context);
  }

  addBreadcrumb(message: string, category?: string, level?: ErrorLevel, data?: any): void {
    if (!this.initialized) return;
    
    Sentry.addBreadcrumb({
      message,
      category: category || 'default',
      level: level || 'info',
      data,
      timestamp: Date.now() / 1000,
    });
  }

  // Mobile-specific convenience methods
  captureNavigationError(error: Error, fromScreen: string, toScreen: string, userId?: string): string {
    return this.captureException(error, {
      screen: 'navigation',
      action: 'navigate',
      fromScreen,
      toScreen,
      userId,
    });
  }

  captureAPIError(error: Error, endpoint: string, method: string, statusCode?: number, userId?: string): string {
    return this.captureException(error, {
      screen: 'api-client',
      action: 'api-call',
      endpoint,
      method,
      statusCode,
      userId,
    });
  }

  captureScreenError(error: Error, screenName: string, props?: any, userId?: string): string {
    return this.captureException(error, {
      screen: screenName,
      action: 'render',
      props,
      userId,
    });
  }

  captureUserAction(action: string, screen: string, userId?: string, data?: any): string {
    return this.captureMessage(`User action: ${action}`, 'info', {
      screen,
      action,
      userId,
      data,
    });
  }

  captureAudioError(error: Error, action: 'record' | 'upload' | 'play', duration?: number, fileSize?: number, userId?: string): string {
    return this.captureException(error, {
      screen: 'audio',
      action,
      duration,
      fileSize,
      userId,
    });
  }

  capturePermissionError(error: Error, permission: string, userId?: string): string {
    return this.captureException(error, {
      screen: 'permissions',
      action: 'request',
      permission,
      userId,
    });
  }

  captureNetworkError(error: Error, url: string, method: string, userId?: string): string {
    return this.captureException(error, {
      screen: 'network',
      action: 'request',
      url,
      method,
      userId,
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
        screen: 'performance',
      }
    );
  }

  startTransaction(name: string, op: string): Sentry.Transaction | undefined {
    if (!this.initialized) return undefined;
    
    return Sentry.startTransaction({ name, op });
  }

  // React Native specific error boundary
  withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    options?: {
      fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
      beforeCapture?: (scope: Sentry.Scope, error: Error, errorInfo: any) => void;
    }
  ): React.ComponentType<P> {
    if (!this.initialized) return WrappedComponent;
    
    return Sentry.withErrorBoundary(WrappedComponent, {
      fallback: options?.fallback || DefaultErrorFallback,
      beforeCapture: options?.beforeCapture,
    });
  }

  // Performance monitoring
  measurePerformance<T>(name: string, operation: () => T): T {
    if (!this.initialized) return operation();
    
    const transaction = this.startTransaction(name, 'performance');
    const startTime = Date.now();
    
    try {
      const result = operation();
      const duration = Date.now() - startTime;
      
      // Log slow operations
      if (duration > 1000) {
        this.capturePerformanceIssue('slow_operation', duration, 1000, {
          operation: name,
        });
      }
      
      transaction?.setStatus('ok');
      return result;
    } catch (error) {
      transaction?.setStatus('internal_error');
      this.captureException(error as Error, { operation: name });
      throw error;
    } finally {
      transaction?.finish();
    }
  }

  async measureAsyncPerformance<T>(name: string, operation: () => Promise<T>): Promise<T> {
    if (!this.initialized) return operation();
    
    const transaction = this.startTransaction(name, 'performance');
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      // Log slow operations
      if (duration > 2000) {
        this.capturePerformanceIssue('slow_async_operation', duration, 2000, {
          operation: name,
        });
      }
      
      transaction?.setStatus('ok');
      return result;
    } catch (error) {
      transaction?.setStatus('internal_error');
      this.captureException(error as Error, { operation: name });
      throw error;
    } finally {
      transaction?.finish();
    }
  }
}

// Default error fallback component for React Native
function DefaultErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  const React = require('react');
  const { View, Text, TouchableOpacity, StyleSheet } = require('react-native');
  
  return React.createElement(View, { style: styles.container },
    React.createElement(View, { style: styles.content },
      React.createElement(Text, { style: styles.title }, 'Something went wrong'),
      React.createElement(Text, { style: styles.message }, 
        'We\'re sorry, but something unexpected happened. The error has been reported and we\'ll look into it.'
      ),
      __DEV__ && React.createElement(Text, { style: styles.error }, error.message),
      React.createElement(View, { style: styles.buttons },
        React.createElement(TouchableOpacity, { 
          style: [styles.button, styles.primaryButton], 
          onPress: resetError 
        },
          React.createElement(Text, { style: styles.primaryButtonText }, 'Try again')
        )
      )
    )
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  content: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  error: {
    fontSize: 12,
    color: '#999',
    marginBottom: 20,
    fontFamily: 'monospace',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

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
  screenName?: string
) {
  const WithErrorTrackingComponent = (props: P) => {
    return errorTracking.withErrorBoundary(WrappedComponent, {
      beforeCapture: (scope, error, errorInfo) => {
        scope.setTag('screen', screenName || WrappedComponent.name);
        scope.setContext('errorInfo', errorInfo);
        scope.setContext('props', props);
      },
    })(props);
  };

  WithErrorTrackingComponent.displayName = `withErrorTracking(${screenName || WrappedComponent.name})`;
  
  return WithErrorTrackingComponent;
}