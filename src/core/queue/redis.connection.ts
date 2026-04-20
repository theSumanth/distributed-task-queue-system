import IORedis, { type RedisOptions } from 'ioredis';

import { config } from '@/config';

let redis: IORedis | null = null;

const createRedisConnection = (): IORedis => {
  if (config.redis.url) {
    return new IORedis(config.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  const options: RedisOptions = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,

    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  if (config.redis.tlsEnabled) {
    options.tls = {};
  }

  return new IORedis(options);
};

export const getRedisConnection = (): IORedis => {
  if (!redis) {
    redis = createRedisConnection();

    redis.on('connect', () => {
      console.log('[Redis] connecting...');
    });

    redis.on('ready', () => {
      console.log('[Redis] ready');
    });

    redis.on('error', (err) => {
      console.error('[Redis] error:', err);
    });

    redis.on('close', () => {
      console.warn('[Redis] connection closed');
    });
  }

  return redis;
};

export const closeRedisConnection = async (): Promise<void> => {
  if (redis && redis.status !== 'end') {
    await redis.quit();
    redis = null;
  }
};

export const pingRedis = async (): Promise<void> => {
  const redisConnection = getRedisConnection();
  if (redisConnection.status === 'wait' || redisConnection.status === 'end') {
    await redisConnection.connect();
  }
  await redisConnection.ping();
};
