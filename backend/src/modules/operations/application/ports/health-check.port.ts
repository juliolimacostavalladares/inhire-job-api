import { SystemHealthStatus } from '../../domain/health-status.vo';

export interface HealthCheckService {
  getLiveness(): SystemHealthStatus;
  getReadiness(): Promise<SystemHealthStatus>;
}

export const HEALTH_CHECK_SERVICE = Symbol('HealthCheckService');
