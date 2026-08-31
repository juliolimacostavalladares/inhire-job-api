export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  storageBucket: string;
  storageEndpoint?: string;
  maxPlaywrightConcurrency: number;
}

export function loadConfig(): AppConfig {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/inhire?schema=public',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwtSecret: process.env.JWT_SECRET || 'inhire-super-secret-jwt-key-2026-strict',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    storageBucket: process.env.STORAGE_BUCKET || 'inhire-resumes',
    storageEndpoint: process.env.STORAGE_ENDPOINT,
    maxPlaywrightConcurrency: parseInt(process.env.MAX_PLAYWRIGHT_CONCURRENCY || '1', 10),
  };
}
