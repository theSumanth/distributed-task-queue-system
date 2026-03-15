import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { config } from '@/config';
import { correlationIdMiddleware, httpLogger } from '@/core/logger';

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

export { app };
