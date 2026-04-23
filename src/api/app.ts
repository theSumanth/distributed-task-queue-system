import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config } from '@/config';
import { correlationIdMiddleware, httpLogger, logger } from '@/core/logger';
import {
  httpMetricsMiddleware,
  initializeMetrics,
  metricsRouter,
  recordApiError,
} from '@/core/metrics';
import { toErrorResponse } from './errors/app-error';
import { sendError } from './utils/response';
import { healthRouter } from './routes/health.routes';
import { jobsRouter } from './routes/jobs.routes';
import { docsRouter } from './routes/docs.routes';

initializeMetrics('app');

const app = express();

if (config.metrics.enabled) {
  app.use(config.metrics.path, metricsRouter);
}

app.use(httpMetricsMiddleware);
app.use(helmet());
app.use(cors({ origin: config.security.corsOrigin }));
app.use(
  rateLimit({
    windowMs: config.security.rateLimitWindowMs,
    limit: config.security.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: true,
  })
);
app.use(correlationIdMiddleware);
app.use(httpLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const apiBase = `/api/${config.apiVersion}`;

app.use('/health', healthRouter);
app.use(`${apiBase}/jobs`, jobsRouter);
app.use(apiBase, docsRouter);

app.use((req, res) => {
  recordApiError('NOT_FOUND', 404);
  sendError(res, 404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`);
});

app.use(
  (error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const normalized = toErrorResponse(error);
    const { code, message, statusCode, details } = normalized;

    logger.error(
      {
        err: error,
        correlationId: req.correlationId,
        path: req.path,
        method: req.method,
      },
      message
    );
    recordApiError(code, statusCode);
    sendError(res, statusCode, code, message, details);
  }
);

export { app };
