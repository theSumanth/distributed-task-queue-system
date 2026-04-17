import z from 'zod';

export const createJobSchema = z
  .object({
    type: z.enum(['email', 'webhook', 'generic']),
    payload: z.record(z.string(), z.unknown()),
    priority: z.enum(['high', 'normal', 'low']).optional(),
    delayMs: z.coerce.number().int().nonnegative().optional(),
    runAt: z.iso.datetime().optional(),
    cron: z.string().min(1).optional(),
    maxRetries: z.coerce.number().int().min(0).max(20).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.delayMs !== undefined && value.runAt !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide either delayMs or runAt, not both',
        path: ['delayMs'],
      });
    }
  });

export const outboxJobEnqueueSchema = createJobSchema.extend({
  jobId: z.uuid(),
});

export type OutboxJobEnqueuePayload = z.infer<typeof outboxJobEnqueueSchema>;
export type CreateJobSchemaType = z.infer<typeof createJobSchema>;
