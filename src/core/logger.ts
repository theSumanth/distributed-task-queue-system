import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

import pino, { type TransportTargetOptions } from 'pino';
import { pinoHttp } from 'pino-http';

import { config } from '@/config';

const prettyTransport: TransportTargetOptions | undefined =
  config.logging.format === 'pretty'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      }
    : undefined;

export const logger = pino({
  level: config.logging.level,
  transport: prettyTransport,
  base: undefined,
});

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestCorrelationId = req.headers['x-correlation-id'];
  const correlationId =
    typeof requestCorrelationId === 'string' && requestCorrelationId.length > 0
      ? requestCorrelationId
      : randomUUID();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
};

export const httpLogger = pinoHttp({
  logger,
  customProps: (req: Request) => ({
    correlationId: req.correlationId,
  }),
  serializers: {
    req: (req: Request) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      correlationId: req.correlationId,
    }),
    res: (res: Response) => ({
      statusCode: res.statusCode,
    }),
  },
});
