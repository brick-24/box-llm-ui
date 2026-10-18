import crypto from 'node:crypto';
import { DiagnosticLog } from '../../shared/types';
import { AppDatabase } from '../storage/database';

export class DiagnosticsService {
  private static db: AppDatabase;
  private static memoryLogs: DiagnosticLog[] = [];
  private static MAX_MEMORY_LOGS = 150;

  public static initialize(db: AppDatabase) {
    this.db = db;
  }

  public static redactSecrets(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((i) => this.redactSecrets(i));

    const redacted: Record<string, any> = {};
    const secretKeys = new Set([
      'authorization', 'api-key', 'apikey', 'x-api-key', 'key', 'token', 'secret', 'password'
    ]);

    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      if (secretKeys.has(lower) && typeof v === 'string') {
        redacted[k] = v.length > 8 ? `${v.slice(0, 4)}...[REDACTED]...${v.slice(-3)}` : '[REDACTED]';
      } else if (typeof v === 'object' && v !== null) {
        redacted[k] = this.redactSecrets(v);
      } else {
        redacted[k] = v;
      }
    }
    return redacted;
  }

  public static log(
    level: 'info' | 'warn' | 'error',
    category: 'api' | 'stream' | 'document' | 'storage' | 'security',
    message: string,
    details?: Record<string, any>
  ): DiagnosticLog {
    const logItem: DiagnosticLog = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      category,
      message,
      details: details ? this.redactSecrets(details) : undefined,
    };

    this.memoryLogs.unshift(logItem);
    if (this.memoryLogs.length > this.MAX_MEMORY_LOGS) {
      this.memoryLogs.pop();
    }

    if (this.db) {
      this.db.addDiagnostic(logItem);
    }

    const prefix = `[Diagnostics][${category.toUpperCase()}] ${message}`;
    const safeDetails = logItem.details;

    if (level === 'error') {
      if (safeDetails && Object.keys(safeDetails).length > 0) {
        console.error(prefix, '\n' + JSON.stringify(safeDetails, null, 2));
      } else {
        console.error(prefix);
      }
    } else if (level === 'warn') {
      if (safeDetails && Object.keys(safeDetails).length > 0) {
        console.warn(prefix, '\n' + JSON.stringify(safeDetails, null, 2));
      } else {
        console.warn(prefix);
      }
    } else {
      if (safeDetails && Object.keys(safeDetails).length > 0) {
        console.log(prefix, '\n' + JSON.stringify(safeDetails, null, 2));
      } else {
        console.log(prefix);
      }
    }

    return logItem;
  }

  public static getLogs(limit = 100): DiagnosticLog[] {
    if (this.db) {
      return this.db.getDiagnostics(limit);
    }
    return this.memoryLogs.slice(0, limit);
  }

  public static clearLogs() {
    this.memoryLogs = [];
    if (this.db) {
      this.db.clearDiagnostics();
    }
  }
}
