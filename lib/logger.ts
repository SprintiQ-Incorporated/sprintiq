/**
 * SprintiQ Production Logger
 *
 * Replaces console.log with environment-aware structured logging.
 * - Development: Human-readable colored output
 * - Production: JSON structured logs (silent for debug level)
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('User action', { userId, action });
 *   logger.error('Operation failed', error, { context });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  userId?: string;
  workspaceId?: string;
  projectId?: string;
  sprintId?: string;
  action?: string;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: LogLevel;
  private isProduction: boolean;
  private defaultContext: LogContext;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.minLevel = this.isProduction ? 'info' : 'debug';
    this.defaultContext = {};
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    const mergedContext = { ...this.defaultContext, ...context };
    if (Object.keys(mergedContext).length > 0) {
      entry.context = mergedContext;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isProduction ? undefined : error.stack,
      };
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    if (this.isProduction) {
      // Structured JSON for log aggregation (Vercel, Datadog, etc.)
      const output = JSON.stringify(entry);
      switch (entry.level) {
        case 'error':
          console.error(output);
          break;
        case 'warn':
          console.warn(output);
          break;
        default:
          console.log(output);
      }
    } else {
      // Human-readable for development
      const colors: Record<LogLevel, string> = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
      };
      const reset = '\x1b[0m';
      const prefix = `${colors[entry.level]}[${entry.level.toUpperCase()}]${reset}`;
      const contextStr = entry.context
        ? ` ${JSON.stringify(entry.context)}`
        : '';

      if (entry.level === 'error' && entry.error) {
        console.error(`${prefix} ${entry.message}${contextStr}`, entry.error);
      } else if (entry.level === 'warn') {
        console.warn(`${prefix} ${entry.message}${contextStr}`);
      } else {
        console.log(`${prefix} ${entry.message}${contextStr}`);
      }
    }
  }

  /**
   * Create a child logger with additional default context
   */
  withContext(context: LogContext): Logger {
    const child = new Logger();
    child.defaultContext = { ...this.defaultContext, ...context };
    child.minLevel = this.minLevel;
    child.isProduction = this.isProduction;
    return child;
  }

  /**
   * Debug level - development only, silent in production
   */
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;
    this.output(this.formatEntry('debug', message, context));
  }

  /**
   * Info level - general operational messages
   */
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;
    this.output(this.formatEntry('info', message, context));
  }

  /**
   * Warn level - recoverable issues
   */
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;
    this.output(this.formatEntry('warn', message, context));
  }

  /**
   * Error level - failures requiring attention
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog('error')) return;
    const err = error instanceof Error ? error : undefined;
    if (error && !(error instanceof Error)) {
      // If error is not an Error instance, add it to context
      context = { ...context, errorValue: String(error) };
    }
    this.output(this.formatEntry('error', message, context, err));
  }

  /**
   * Performance timing helper
   * Usage: const done = logger.startTimer('fetchTasks'); ... done();
   */
  startTimer(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = Math.round(performance.now() - start);
      this.info(`${label} completed`, { duration, action: label });
    };
  }

  /**
   * Async operation wrapper with automatic timing
   */
  async timed<T>(label: string, fn: () => Promise<T>, context?: LogContext): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - start);
      this.info(`${label} succeeded`, { ...context, duration, action: label });
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      this.error(`${label} failed`, error, { ...context, duration, action: label });
      throw error;
    }
  }
}

// Singleton instance
export const logger = new Logger();

// Type exports for consumers
export type { LogContext, LogLevel, LogEntry };

// Default export for convenience
export default logger;
