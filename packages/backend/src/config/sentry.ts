import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';
import { Express } from 'express';

export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
  beforeSend?: (event: Sentry.Event) => Sentry.Event | null;
}

export class SentryService {
  private static initialized = false;

  static init(app: Express, config: SentryConfig): void {
    if (this.initialized) {
      console.warn('Sentry already initialized');
      return;
    }

    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      tracesSampleRate: config.tracesSampleRate,
      profilesSampleRate: config.profilesSampleRate,
      beforeSend: config.beforeSend,
      integrations: [
        // Enable HTTP calls tracing
        new Sentry.Integrations.Http({ tracing: true }),
        // Enable Express.js middleware tracing
        new Tracing.Integrations.Express({ app }),
        // Enable database tracing
        new Tracing.Integrations.Postgres(),
        // Redis integration not available in current version
      ],
      // Performance monitoring
      beforeSendTransaction(event) {
        // Filter out health check transactions
        if (event.transaction === 'GET /health') {
          return null;
        }
        return event;
      },
    });

    // RequestHandler creates a separate execution context using domains, so that every
    // transaction/span/breadcrumb is attached to its own Hub instance
    app.use(Sentry.Handlers.requestHandler());
    
    // TracingHandler creates a trace for every incoming request
    app.use(Sentry.Handlers.tracingHandler());

    this.initialized = true;
    console.log(`✅ Sentry initialized for environment: ${config.environment}`);
  }

  static getErrorHandler() {
    return Sentry.Handlers.errorHandler({
      shouldHandleError(error: any) {
        // Capture all 4xx and 5xx errors
        return error.status && typeof error.status === 'number' && error.status >= 400;
      },
    });
  }

  static captureException(error: Error, context?: any): string {
    return Sentry.captureException(error, {
      tags: context?.tags,
      extra: context?.extra,
      user: context?.user,
      level: context?.level || 'error',
    });
  }

  static captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: any): string {
    return Sentry.captureMessage(message, {
      level,
      tags: context?.tags,
      extra: context?.extra,
      user: context?.user,
    });
  }

  static addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    Sentry.addBreadcrumb(breadcrumb);
  }

  static setUser(user: { id: string; email?: string; username?: string }): void {
    Sentry.setUser(user);
  }

  static setTag(key: string, value: string): void {
    Sentry.setTag(key, value);
  }

  static setContext(key: string, context: any): void {
    Sentry.setContext(key, context);
  }

  static startTransaction(name: string, op: string): Sentry.Transaction {
    return Sentry.startTransaction({ name, op });
  }

  static async withTransaction<T>(
    name: string,
    op: string,
    callback: (transaction: Sentry.Transaction) => Promise<T>
  ): Promise<T> {
    const transaction = this.startTransaction(name, op);
    
    try {
      const result = await callback(transaction);
      transaction.setStatus('ok');
      return result;
    } catch (error) {
      transaction.setStatus('internal_error');
      this.captureException(error as Error);
      throw error;
    } finally {
      transaction.finish();
    }
  }

  static configureScope(callback: (scope: Sentry.Scope) => void): void {
    Sentry.configureScope(callback);
  }
}

// Default configuration factory
export function createSentryConfig(): SentryConfig {
  return {
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend: (event) => {
      // Filter out sensitive information
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      
      // Filter out health check errors
      if (event.request?.url?.includes('/health')) {
        return null;
      }
      
      return event;
    },
  };
}

// Validation function
export function validateSentryConfig(): boolean {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.warn('⚠️ SENTRY_DSN not configured. Error tracking will be disabled.');
    return false;
  }
  
  if (!dsn.startsWith('https://')) {
    console.error('❌ Invalid SENTRY_DSN format. Must be a valid Sentry DSN URL.');
    return false;
  }
  
  return true;
}