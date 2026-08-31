import { Injectable, LoggerService } from '@nestjs/common';

export interface StructuredLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  process: 'api' | 'worker';
  module?: string;
  traceId?: string;
  correlationId?: string;
  jobId?: string;
  resourceId?: string;
  operation?: string;
  outcome?: string;
  durationMs?: number;
  errorCode?: string;
  message?: string;
  [key: string]: unknown;
}

@Injectable()
export class SanitizedLogger implements LoggerService {
  private readonly process: 'api' | 'worker' = (process.env.PROCESS_TYPE as 'api' | 'worker') || 'api';
  private static readonly SENSITIVE_KEYS = new Set([
    'password',
    'token',
    'cookie',
    'authorization',
    'secret',
    'pdf',
    'base64',
    'prompt',
    'email',
    'phone',
    'address',
    'answers',
    'formData',
  ]);

  private sanitize(obj: unknown, depth = 0): unknown {
    if (depth > 5) return '[MAX_DEPTH]';
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item, depth + 1));
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SanitizedLogger.SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitize(value, depth + 1);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  log(message: unknown, context?: string): void {
    this.writeLog('info', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.writeLog('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.writeLog('warn', message, context);
  }

  debug?(message: unknown, context?: string): void {
    this.writeLog('debug', message, context);
  }

  private writeLog(level: 'info' | 'warn' | 'error' | 'debug', message: unknown, context?: string, trace?: string): void {
    const timestamp = new Date().toISOString();
    let payload: Record<string, unknown> = {};

    if (typeof message === 'object' && message !== null) {
      payload = this.sanitize(message) as Record<string, unknown>;
    } else {
      payload = { message: String(message) };
    }

    const logEntry: StructuredLog = {
      timestamp,
      level,
      process: this.process,
      module: context,
      ...(payload as Record<string, unknown>),
    };

    if (trace) {
      logEntry['stack'] = trace;
    }

    // Output structured JSON
    const jsonOutput = JSON.stringify(logEntry);
    if (level === 'error') {
      process.stderr.write(jsonOutput + '\n');
    } else {
      process.stdout.write(jsonOutput + '\n');
    }
  }
}
