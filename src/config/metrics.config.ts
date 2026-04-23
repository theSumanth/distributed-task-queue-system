import z from 'zod';

import { booleanFromEnv } from './helpers/boolean';

const normalizePath = (path: string): string => {
  const trimmed = path.trim();
  if (!trimmed) return '/metrics';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const optionalToken = z
  .string()
  .optional()
  .transform((value) => {
    const token = value?.trim();
    return token ? token : undefined;
  });

export const metricsSchema = z.object({
  METRICS_ENABLED: booleanFromEnv.default(true),
  METRICS_PATH: z.string().default('/metrics').transform(normalizePath),
  METRICS_HOST: z.string().default('0.0.0.0'),
  METRICS_TOKEN: optionalToken,
  METRICS_COLLECT_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  QUEUE_WORKER_METRICS_PORT: z.coerce.number().int().positive().default(9101),
  OUTBOX_WORKER_METRICS_PORT: z.coerce.number().int().positive().default(9102),
});

export const parseMetricsConfig = (env: NodeJS.ProcessEnv) => {
  return metricsSchema.parse(env);
};
