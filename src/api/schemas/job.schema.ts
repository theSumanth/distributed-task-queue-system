import z from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

// ================================
// ENUMS
// ================================

export const jobTypeSchema = z.enum(['email', 'webhook', 'generic']).openapi({
  example: 'email',
});

export const jobPrioritySchema = z.enum(['high', 'normal', 'low']).openapi({
  example: 'normal',
});

export const jobStatusSchema = z
  .enum(['queued', 'active', 'completed', 'failed', 'retrying', 'dead_letter', 'cancelled'])
  .openapi({ example: 'queued' });

export type JobType = z.infer<typeof jobTypeSchema>;
export type JobPriority = z.infer<typeof jobPrioritySchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;

// ================================
// CREATE JOB
// ================================

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

// ================================
// JOB RECORD (DB shape → API response)
// ================================

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

// ================================
// JOB EVENTS
// ================================

export const jobEventSchema = z
  .object({
    id: z.number(),
    jobId: z.uuid(),
    status: jobStatusSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.string(),
  })
  .openapi('JobEvent');

export type JobEventRecord = z.infer<typeof jobEventSchema>;

// ================================
// GET JOB — job + full event history
// ================================

export const jobWithEventsSchema = jobRecordSchema
  .extend({
    events: z.array(jobEventSchema),
  })
  .openapi('JobWithEvents');

export type JobWithEvents = z.infer<typeof jobWithEventsSchema>;

// ================================
// LIST JOBS — query params + response
// ================================

export const listJobsQuerySchema = z
  .object({
    status: jobStatusSchema.optional(),
    type: jobTypeSchema.optional(),
    page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
    limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
  })
  .openapi('ListJobsQuery');

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;

export const paginationMetaSchema = z
  .object({
    total: z.number().openapi({ example: 100 }),
    page: z.number().openapi({ example: 1 }),
    limit: z.number().openapi({ example: 20 }),
    totalPages: z.number().openapi({ example: 5 }),
  })
  .openapi('PaginationMeta');

export const listJobsResponseSchema = z
  .object({
    jobs: z.array(jobRecordSchema),
    pagination: paginationMetaSchema,
  })
  .openapi('ListJobsResponse');

export type ListJobsResponse = z.infer<typeof listJobsResponseSchema>;

// ================================
// GET JOBS — query param
// ================================
export const jobIdQuerySchema = z.object({ id: z.uuid() });

// ================================
// QUEUE INTERNALS (outbox → bullmq)
// ================================

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
