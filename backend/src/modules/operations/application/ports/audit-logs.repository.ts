import { AuditLog } from '../../domain/audit-log.entity';

export interface AuditLogsRepository {
  save(log: AuditLog): Promise<AuditLog>;
  findAll(filter?: { action?: string; targetType?: string; page?: number; limit?: number }): Promise<{ items: AuditLog[]; total: number }>;
}

export const AUDIT_LOGS_REPOSITORY = Symbol('AuditLogsRepository');
