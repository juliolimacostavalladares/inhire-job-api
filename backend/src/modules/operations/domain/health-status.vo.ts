export interface DependencyHealth {
  status: 'UP' | 'DOWN';
  latencyMs?: number;
  message?: string;
}

export interface SystemHealthStatus {
  isLive: boolean;
  isReady: boolean;
  timestamp: string;
  dependencies: {
    database: DependencyHealth;
    redis: DependencyHealth;
    storage: DependencyHealth;
  };
}
