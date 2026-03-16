import type { Response } from 'express';

import type { ApiEnvelope, ApiError } from '@/types/api';

const buildEnvelope = <T>(
  correlationId: string,
  data: T | null,
  error: ApiError | null
): ApiEnvelope<T> => ({
  success: error === null,
  data,
  error,
  correlationId,
  timestamp: new Date().toISOString(),
});

export const sendSuccess = <T>(res: Response, statusCode: number, data: T): void => {
  const envelope = buildEnvelope(res.req.correlationId, data, null);
  res.status(statusCode).json(envelope);
};

export const sendError = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
) => {
  const envelope = buildEnvelope(res.req.correlationId, null, {
    code,
    message,
    details,
  });
  res.status(statusCode).json(envelope);
};
