import z from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const jobTypeSchema = z.enum(['email', 'webhook', 'generic']).openapi({
  example: 'email',
});

export const jobPrioritySchema = z.enum(['high', 'normal', 'low']).openapi({
  example: 'normal',
});

export const jobStatusSchema = z
  .enum(['queued', 'active', 'completed', 'failed', 'retrying', 'dead_letter', 'cancelled'])
  .openapi({
    example: 'queued',
  });

export type JobType = z.infer<typeof jobTypeSchema>;
export type JobPriority = z.infer<typeof jobPrioritySchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const createJobSchema = z
  .object({
    type: jobTypeSchema,

    payload: z.record(z.string(), z.unknown()).openapi({
      example: { to: 'user@example.com' },
    }),

    priority: jobPrioritySchema.optional(),

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
  })
  .openapi('CreateJob');

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const jobRecordSchema = z
  .object({
    id: z.uuid(),
    queueJobId: z.string().nullable(),

    type: jobTypeSchema,
    status: jobStatusSchema,
    priority: jobPrioritySchema,

    payload: z.record(z.string(), z.unknown()),
    result: z.record(z.string(), z.unknown()).nullable(),
    error: z.record(z.string(), z.unknown()).nullable(),

    attempts: z.number(),
    maxRetries: z.number(),
    delayMs: z.number(),

    runAt: z.string().nullable(),
    cron: z.string().nullable(),

    createdAt: z.string(),
    updatedAt: z.string(),

    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    failedAt: z.string().nullable(),
  })
  .openapi('JobRecord');

export type JobRecord = z.infer<typeof jobRecordSchema>;

export const queueJobPayloadSchema = z.object({
  jobId: z.uuid(),
  type: jobTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  maxRetries: z.number(),
});

export type QueueJobPayload = z.infer<typeof queueJobPayloadSchema>;

export const outboxJobEnqueueSchema = createJobSchema.extend({
  jobId: z.uuid(),
});

export const outboxDLQJobEnqueueSchema = z.object({
  jobId: z.uuid(),
  type: jobTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  maxRetries: z.number(),
});

export type OutboxJobEnqueuePayload = z.infer<typeof outboxJobEnqueueSchema>;
export type OutboxDLQJobEnqueuePayload = z.infer<typeof outboxDLQJobEnqueueSchema>;

/**
 * ================================
 * JOB EVENTS
 * ================================
 */
export const jobEventSchema = z.object({
  id: z.number(),
  jobId: z.uuid(),
  status: jobStatusSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});

export type JobEventRecord = z.infer<typeof jobEventSchema>;
