import { Counter, Histogram } from 'prom-client';
import { Router, type Request, type Response, type NextFunction } from 'express';

import { elapsedSecondsSince, isMetricsEnabled, metricsRegistry } from './registry';

const httpRequestsTotal = new Counter({
  name: 'task_queue_http_requests_total',
  help: 'Total HTTP requests served by the API.',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

const httpRequestDurationSeconds = new Histogram({
  name: 'task_queue_http_request_duration_seconds',
  help: 'HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

const apiErrorsTotal = new Counter({
  name: 'task_queue_api_errors_total',
  help: 'Total API errors returned by normalized error code.',
  labelNames: ['code', 'status_code'] as const,
  registers: [metricsRegistry],
});

const routePathToLabel = (path: unknown): string | null => {
  if (typeof path === 'string') return path;
  if (path instanceof RegExp) return 'regexp';
  if (Array.isArray(path)) {
    const first = path.find((item): item is string => typeof item === 'string');
    return first ?? 'array';
  }
  return null;
};

const joinRouteLabel = (baseUrl: string, routePath: string): string => {
  if (routePath === '/') return baseUrl || '/';
  return `${baseUrl}${routePath}`;
};

const getRouteLabel = (req: Request, statusCode: number): string => {
  const routePath = routePathToLabel(req.route?.path);
  if (routePath) return joinRouteLabel(req.baseUrl, routePath);
  if (statusCode === 404) return 'unmatched';
  return 'unknown';
};

export const httpMetricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!isMetricsEnabled()) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();

  res.once('finish', () => {
    const statusCode = String(res.statusCode);
    const labels = {
      method: req.method,
      route: getRouteLabel(req, res.statusCode),
      status_code: statusCode,
    };

    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, elapsedSecondsSince(startedAt));
  });

  next();
};

export const recordApiError = (code: string, statusCode: number): void => {
  if (!isMetricsEnabled()) return;
  apiErrorsTotal.inc({ code, status_code: String(statusCode) });
};

export const metricsRouter = Router();

metricsRouter.get('/', async (_req: Request, res: Response) => {
  if (!isMetricsEnabled()) {
    res.status(404).send('Metrics are disabled');
    return;
  }

  res.setHeader('Content-Type', metricsRegistry.contentType);
  res.send(await metricsRegistry.metrics());
});
