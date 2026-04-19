import z from 'zod';

export const queueSchema = z.object({
  QUEUE_NAME: z.string().default('jobs'),

  QUEUE_DEFAULT_CONCURRENCY: z.coerce.number().int().positive().default(5),

  QUEUE_MAX_RETRIES: z.coerce.number().int().min(0).max(20).default(3),

  QUEUE_BACKOFF_TYPE: z.enum(['fixed', 'exponential']).default('exponential'),
  QUEUE_BACKOFF_DELAY_MS: z.coerce.number().int().min(100).max(60000).default(5000),

  QUEUE_REMOVE_ON_COMPLETE: z
    .union([z.coerce.number().int().positive(), z.literal(false)])
    .default(100),

  QUEUE_REMOVE_ON_FAIL: z.union([z.coerce.number().int().positive(), z.literal(false)]).default(50),
});

export const parseQueueConfig = (env: NodeJS.ProcessEnv) => {
  return queueSchema.parse(env);
};
