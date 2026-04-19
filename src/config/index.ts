import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

import { parseAppConfig } from './app.config';
import { parseSecurityConfig } from './security.config';
import { parseLoggingConfig } from './logging.config';
import { parseDatabaseConfig } from './database.config';
import { parseRedisConfig } from './redis.config';
import { parseQueueConfig } from './queue.config';
import { parseOutboxConfig } from './outbox.config';
import { parseQueueWorkerConfig } from './worker.config';
import { parseFeaturesConfig } from './features.config';

const envFile = `.env.${process.env['NODE_ENV'] || 'development'}`;

dotenv.config({
  path: path.resolve(process.cwd(), envFile),
});

const parseConfig = () => {
  try {
    const app = parseAppConfig(process.env);
    const database = parseDatabaseConfig(process.env);
    const security = parseSecurityConfig(process.env);
    const logging = parseLoggingConfig(process.env);
    const redis = parseRedisConfig(process.env);
    const queue = parseQueueConfig(process.env);
    const outbox = parseOutboxConfig(process.env);
    const worker = parseQueueWorkerConfig(process.env);
    const features = parseFeaturesConfig(process.env);

    return { app, database, security, logging, redis, queue, outbox, worker, features };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(z.treeifyError(error).errors, 'Invalid environment variables:');
      process.exit(1);
    }

    console.error(error, 'Unexpected error while parsing Config');
    process.exit(1);
  }
};

const env = parseConfig();

export const config = {
  nodeEnv: env.app.NODE_ENV,
  port: env.app.PORT,

  database: {
    url: env.database.DATABASE_URL,
    host: env.database.DB_HOST,
    port: env.database.DB_PORT,
    name: env.database.DB_NAME,
    password: env.database.DB_PASSWORD,
    user: env.database.DB_USER,
    sslEnabled: env.database.DB_SSL_ENABLED,
  },

  redis: {
    url: env.redis.REDIS_URL,
    host: env.redis.REDIS_HOST,
    port: env.redis.REDIS_PORT,
    password: env.redis.REDIS_PASSWORD,
    tlsEnabled: env.redis.REDIS_TLS_ENABLED,
  },

  queue: {
    name: env.queue.QUEUE_NAME,
    defaultConcurrency: env.queue.QUEUE_DEFAULT_CONCURRENCY,
    maxRetries: env.queue.QUEUE_MAX_RETRIES,
    backoff: {
      type: env.queue.QUEUE_BACKOFF_TYPE,
      delayMs: env.queue.QUEUE_BACKOFF_DELAY_MS,
    },
    removeOnComplete: env.queue.QUEUE_REMOVE_ON_COMPLETE,
    removeOnFail: env.queue.QUEUE_REMOVE_ON_FAIL,
  },

  worker: {
    concurrency: env.worker.WORKER_CONCURRENCY,
    lockDuration: env.worker.WORKER_LOCK_DURATION,
    lockRenewTime: env.worker.WORKER_LOCK_RENEW_TIME,
  },

  outbox: {
    pollIntervalMs: env.outbox.OUTBOX_POLL_INTERVAL_MS,
    batchSize: env.outbox.OUTBOX_BATCH_SIZE,
    maxAttempts: env.outbox.OUTBOX_MAX_ATTEMPTS,
    backoffBaseMs: env.outbox.OUTBOX_BACKOFF_BASE_MS,
  },

  features: {
    deadLetterQueue: env.features.ENABLE_DEAD_LETTER_QUEUE,
    scheduledJobs: env.features.ENABLE_SCHEDULED_JOBS,
  },

  security: {
    rateLimitWindowMs: env.security.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: env.security.RATE_LIMIT_MAX_REQUESTS,
    corsOrigin: env.security.CORS_ORIGIN,
  },

  logging: {
    level: env.logging.LOG_LEVEL,
    format: env.logging.LOG_FORMAT,
  },

  isDevelopment: env.app.NODE_ENV === 'development',
  isStaging: env.app.NODE_ENV === 'staging',
  isProduction: env.app.NODE_ENV === 'production',
} as const;

export const redactedConfig = {
  ...config,
  database: {
    ...config.database,
    password: config.database.password ? '***redacted***' : undefined,
  },
  redis: {
    ...config.redis,
    password: config.redis.password ? '***redacted***' : undefined,
  },
};

export type Config = typeof config;
