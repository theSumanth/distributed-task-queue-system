import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config } from '@/config';
import { correlationIdMiddleware, httpLogger } from '@/core/logger';
import { healthRouter } from './routes/health.routes';
import { NotFoundError, toErrorResponse } from './errors/app-error';
import { sendError } from './utils/response';

const app = express();

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

app.use('/health', healthRouter);

app.use((req, _res) => {
  throw new NotFoundError(`Route not found: ${req.method} ${req.path}`);
});

app.use((error: unknown, _req: express.Request, res: express.Response) => {
  const normalized = toErrorResponse(error);
  const { code, message, statusCode, details } = normalized;
  sendError(res, statusCode, code, message, details);
});

export { app };
