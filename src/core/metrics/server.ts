import http from 'node:http';

import { config } from '@/config';
import { logger } from '@/core/logger';

import { isMetricsEnabled, metricsRegistry, type MetricsRole } from './registry';

export const startMetricsServer = (role: MetricsRole, port: number): http.Server | null => {
  if (!isMetricsEnabled()) return null;

  const server = http.createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

      if (req.method !== 'GET' || url.pathname !== config.metrics.path) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const body = await metricsRegistry.metrics();
      res.writeHead(200, { 'content-type': metricsRegistry.contentType });
      res.end(body);
    })().catch((error: unknown) => {
      logger.error({ error, role }, 'Failed to render metrics');
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Failed to render metrics');
    });
  });

  server.on('error', (error) => {
    logger.error({ error, role, host: config.metrics.host, port }, 'Metrics server error');
  });

  server.listen(port, config.metrics.host, () => {
    logger.info(
      { role, host: config.metrics.host, port, path: config.metrics.path },
      'Metrics server started'
    );
  });

  return server;
};

export const closeMetricsServer = async (server: http.Server | null): Promise<void> => {
  if (!server) return;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
};
