import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, Processor } from 'bullmq';
import IORedis from 'ioredis';
import { SanitizedLogger } from '../logger/sanitized-logger.service';

export interface QueueJobPayload {
  [key: string]: string | number | boolean | undefined;
  correlationId?: string;
}

export type QueueName =
  | 'tenant-discovery'
  | 'job-collection'
  | 'profile-analysis'
  | 'resume-generation'
  | 'job-application'
  | 'auto-apply';

@Injectable()
export class BullMQService implements OnModuleInit, OnModuleDestroy {
  private redisConnection: IORedis | null = null;
  private readonly queues = new Map<QueueName, Queue>();
  private readonly workers = new Map<QueueName, Worker>();
  private isInMemoryMode = false;
  private inMemoryQueue = new Map<string, { jobName: string; data: unknown; jobId: string }>();

  constructor(private readonly logger: SanitizedLogger) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.redisConnection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        connectTimeout: 2000,
        retryStrategy: () => null,
      });

      await this.redisConnection.connect().catch(() => {
        this.isInMemoryMode = true;
        this.logger.warn('Redis unavailable, falling back to in-memory queue mode for BullMQ', 'BullMQService');
      });
    } catch {
      this.isInMemoryMode = true;
      this.logger.warn('Failed to initialize Redis connection, using in-memory queue', 'BullMQService');
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    if (this.redisConnection && this.redisConnection.status === 'ready') {
      await this.redisConnection.quit();
    }
  }

  getQueue(name: QueueName): Queue | null {
    if (this.isInMemoryMode || !this.redisConnection) return null;
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: this.redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: { count: 1000 },
          removeOnFail: { age: 30 * 24 * 3600 },
        },
      });
      this.queues.set(name, queue);
    }
    return this.queues.get(name)!;
  }

  getAllQueues(): Queue[] {
    const queueNames: QueueName[] = [
      'tenant-discovery',
      'job-collection',
      'profile-analysis',
      'resume-generation',
      'job-application',
      'auto-apply',
    ];
    return queueNames.map((name) => this.getQueue(name)).filter((q): q is Queue => q !== null);
  }

  async addJob<T extends QueueJobPayload>(
    queueName: QueueName,
    jobName: string,
    data: T,
    jobId: string,
    opts?: { attempts?: number; delay?: number }
  ): Promise<void> {
    this.logger.log({
      operation: 'enqueue_job',
      queue: queueName,
      jobName,
      jobId,
      correlationId: data.correlationId,
    }, 'BullMQService');

    const sanitizedJobId = jobId.replace(/:/g, '__');
    const queue = this.getQueue(queueName);
    if (queue) {
      await queue.add(jobName, data, {
        jobId: sanitizedJobId,
        attempts: opts?.attempts ?? 3,
        delay: opts?.delay ?? 0,
      });
    } else {
      this.inMemoryQueue.set(sanitizedJobId, { jobName, data, jobId: sanitizedJobId });
    }
  }

  registerWorker<T, R>(
    queueName: QueueName,
    processor: Processor<T, R>,
    concurrency = 1
  ): Worker<T, R> | null {
    if (this.isInMemoryMode || !this.redisConnection) {
      this.logger.log(`Worker for ${queueName} registered in in-memory mode`, 'BullMQService');
      return null;
    }

    const worker = new Worker<T, R>(queueName, processor, {
      connection: this.redisConnection,
      concurrency,
      lockDuration: 60000,
    });

    worker.on('failed', (job, err) => {
      this.logger.error({
        operation: 'job_failed',
        queue: queueName,
        jobId: job?.id,
        error: err.message,
      }, err.stack, 'BullMQWorker');
    });

    worker.on('completed', (job) => {
      this.logger.log({
        operation: 'job_completed',
        queue: queueName,
        jobId: job.id,
      }, 'BullMQWorker');
    });

    this.workers.set(queueName, worker as Worker);
    return worker;
  }

  async getQueueMetrics(queueName: QueueName): Promise<{ waiting: number; active: number; failed: number; completed: number }> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      return { waiting: 0, active: 0, failed: 0, completed: 0 };
    }
    const [waiting, active, failed, completed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getFailedCount(),
      queue.getCompletedCount(),
    ]);
    return { waiting, active, failed, completed };
  }
}
