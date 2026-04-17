import z from 'zod';

export const outboxSchema = z.object({
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(10),
});

export const parseOutboxConfig = (env: NodeJS.ProcessEnv) => {
  return outboxSchema.parse(env);
};
