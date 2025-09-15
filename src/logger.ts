import winston from 'winston';
import { randomUUID } from 'crypto';

export interface LogContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  boardId?: string;
  duration?: number;
  [key: string]: any;
}

export interface SecurityEvent {
  type: 'authentication' | 'authorization' | 'rate_limit' | 'input_validation' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  details: Record<string, any>;
}

class Logger {
  private winston: winston.Logger;
  private correlationId: string;

  constructor() {
    this.correlationId = randomUUID();
    this.winston = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const isProduction = process.env.NODE_ENV === 'production';

    // Create custom formats
    const customFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.metadata(),
      isProduction ? winston.format.json() : winston.format.simple()
    );

    // Configure transports
    const transports: winston.transport[] = [
      new winston.transports.Console({
        level: logLevel,
        format: customFormat,
        stderrLevels: ['error', 'warn']
      })
    ];

    // Add file transports in production
    if (isProduction) {
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: customFormat,
          maxsize: 10485760, // 10MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          format: customFormat,
          maxsize: 10485760, // 10MB
          maxFiles: 10
        })
      );
    }

    return winston.createLogger({
      level: logLevel,
      format: customFormat,
      transports,
      // Don't exit on handled exceptions
      exitOnError: false
    });
  }

  private sanitizeForLogging(data: any): any {
    if (typeof data === 'string') {
      return data
        .replace(/api[_-]?token[:\s]+[^\s]+/gi, 'api_token: [REDACTED]')
        .replace(/password[:\s]+[^\s]+/gi, 'password: [REDACTED]')
        .replace(/bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = Array.isArray(data) ? [] : {};

      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          // Redact sensitive keys
          if (/token|password|secret|key|auth/i.test(key)) {
            sanitized[key] = '[REDACTED]';
          } else {
            sanitized[key] = this.sanitizeForLogging(data[key]);
          }
        }
      }

      return sanitized;
    }

    return data;
  }

  private enrichContext(context: LogContext = {}): LogContext {
    return {
      ...context,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString(),
      service: 'jira-mcp-server',
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development'
    };
  }

  info(message: string, context: LogContext = {}): void {
    const enrichedContext = this.enrichContext(context);
    const sanitizedContext = this.sanitizeForLogging(enrichedContext);

    this.winston.info(message, sanitizedContext);
  }

  warn(message: string, context: LogContext = {}): void {
    const enrichedContext = this.enrichContext(context);
    const sanitizedContext = this.sanitizeForLogging(enrichedContext);

    this.winston.warn(message, sanitizedContext);
  }

  error(message: string, error?: Error, context: LogContext = {}): void {
    const enrichedContext = this.enrichContext({
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined
    });
    const sanitizedContext = this.sanitizeForLogging(enrichedContext);

    this.winston.error(message, sanitizedContext);
  }

  debug(message: string, context: LogContext = {}): void {
    const enrichedContext = this.enrichContext(context);
    const sanitizedContext = this.sanitizeForLogging(enrichedContext);

    this.winston.debug(message, sanitizedContext);
  }

  // Security-specific logging
  security(event: SecurityEvent, context: LogContext = {}): void {
    const securityContext = this.enrichContext({
      ...context,
      security: {
        type: event.type,
        severity: event.severity,
        source: event.source,
        details: this.sanitizeForLogging(event.details)
      }
    });

    const level = event.severity === 'critical' || event.severity === 'high' ? 'error' : 'warn';
    this.winston.log(level, `Security Event: ${event.type}`, securityContext);
  }

  // Performance logging
  performance(operation: string, duration: number, context: LogContext = {}): void {
    const perfContext = this.enrichContext({
      ...context,
      operation,
      duration,
      performance: true
    });

    this.winston.info(`Performance: ${operation} completed`, perfContext);
  }

  // API request logging
  apiRequest(method: string, url: string, statusCode: number, duration: number, context: LogContext = {}): void {
    const apiContext = this.enrichContext({
      ...context,
      api: {
        method,
        url: this.sanitizeForLogging(url),
        statusCode,
        duration
      }
    });

    const level = statusCode >= 400 ? 'warn' : 'info';
    this.winston.log(level, `API Request: ${method} ${url}`, apiContext);
  }

  // Rate limiting events
  rateLimitHit(source: string, limit: number, window: number, context: LogContext = {}): void {
    this.security({
      type: 'rate_limit',
      severity: 'medium',
      source,
      details: {
        limit,
        window,
        ...context
      }
    }, context);
  }

  // Authentication events
  authenticationEvent(success: boolean, reason?: string, context: LogContext = {}): void {
    this.security({
      type: 'authentication',
      severity: success ? 'low' : 'high',
      source: 'jira-api',
      details: {
        success,
        reason: reason || (success ? 'Authentication successful' : 'Authentication failed'),
        ...context
      }
    }, context);
  }

  // Input validation events
  validationError(field: string, value: any, reason: string, context: LogContext = {}): void {
    this.security({
      type: 'input_validation',
      severity: 'medium',
      source: 'input-validator',
      details: {
        field,
        value: this.sanitizeForLogging(value),
        reason,
        ...context
      }
    }, context);
  }

  // Create child logger with additional context
  child(additionalContext: LogContext): Logger {
    const childLogger = new Logger();
    childLogger.correlationId = this.correlationId;

    // Override the enrichContext method to include additional context
    const originalEnrichContext = childLogger.enrichContext.bind(childLogger);
    childLogger.enrichContext = (context: LogContext = {}) => {
      return originalEnrichContext({
        ...additionalContext,
        ...context
      });
    };

    return childLogger;
  }

  // Generate new correlation ID for new request
  newRequest(): string {
    this.correlationId = randomUUID();
    return this.correlationId;
  }

  getCorrelationId(): string {
    return this.correlationId;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export Logger class for testing
export { Logger };