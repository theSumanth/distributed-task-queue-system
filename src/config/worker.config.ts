import z from 'zod';

export const queueWorkerSchema = z.object({
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  WORKER_LOCK_DURATION: z.coerce.number().int().positive().default(30000),
  WORKER_LOCK_RENEW_TIME: z.coerce.number().int().positive().default(15000),
});

export const parseQueueWorkerConfig = (env: NodeJS.ProcessEnv) => {
  return queueWorkerSchema.parse(env);
};
