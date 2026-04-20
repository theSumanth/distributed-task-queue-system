import http from 'node:http';
import type { Socket } from 'node:net';

import { app } from '@/api/app';
import { config, redactedConfig } from '@/config';
import { logger } from '@/core/logger';
import { closeDbPool } from '@/database/client';
import { closeRedisConnection } from '@/core/queue/redis.connection';

const server = http.createServer(app);

const connections = new Set<Socket>();

server.on('connection', (conn) => {
  connections.add(conn);
  conn.on('close', () => connections.delete(conn));
});

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Shutdown signal received');

  const SHUTDOWN_TIMEOUT = 10000;

  setTimeout(() => {
    logger.error('Forcing shutdown after timeout');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  server.close((error) => {
    if (error) {
      logger.error({ error }, 'Error closing server');
      process.exit(1);
    }
  });

  try {
    await Promise.all([closeDbPool(), closeRedisConnection()]);

    // destroy remaining connections
    for (const conn of connections) {
      conn.destroy();
    }

    logger.info('Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Shutdown failed');
    process.exit(1);
  }
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

server.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      env: config.nodeEnv,
      config: redactedConfig,
    },
    'API server started'
  );
});
