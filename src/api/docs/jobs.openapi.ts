import { z } from 'zod';
import { registry } from '@/api/docs/openapi.registry';

import { createJobSchema, jobRecordSchema, jobEventSchema } from '@/api/schemas/job.schema';

import { createSuccessEnvelope, errorEnvelopeSchema } from '@/api/schemas/api.schema';

import { config } from '@/config';

const basePath = `/api/${config.apiVersion}`;

/**
 * =========================
 * SCHEMA REGISTRATION
 * =========================
 */
registry.register('CreateJob', createJobSchema);
registry.register('JobRecord', jobRecordSchema);
registry.register('JobEventRecord', jobEventSchema);

/**
 * =========================
 * POST /jobs
 * =========================
 */
registry.registerPath({
  method: 'post',
  path: `${basePath}/jobs`,
  tags: ['Jobs'],
  summary: 'Create a new job',

  request: {
    body: {
      content: {
        'application/json': {
          schema: createJobSchema,
        },
      },
    },
  },

  responses: {
    201: {
      description: 'Job created',
      content: {
        'application/json': {
          schema: createSuccessEnvelope(jobRecordSchema),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: errorEnvelopeSchema,
        },
      },
    },
  },
});

/**
 * =========================
 * GET /jobs (LIST)
 * =========================
 */
registry.registerPath({
  method: 'get',
  path: `${basePath}/jobs`,
  tags: ['Jobs'],
  summary: 'List jobs with filters and pagination',

  request: {
    query: z.object({
      status: z.string().optional(),
      type: z.string().optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(10),
    }),
  },

  responses: {
    200: {
      description: 'List of jobs',
      content: {
        'application/json': {
          schema: createSuccessEnvelope(
            z.object({
              data: z.array(jobRecordSchema),
              pagination: z.object({
                page: z.number(),
                limit: z.number(),
                total: z.number(),
              }),
            })
          ),
        },
      },
    },
  },
});

/**
 * =========================
 * GET /jobs/{id}
 * =========================
 */
registry.registerPath({
  method: 'get',
  path: `${basePath}/jobs/{id}`,
  tags: ['Jobs'],
  summary: 'Get job by id with lifecycle events',

  request: {
    params: z.object({
      id: z.uuid(),
    }),
  },

  responses: {
    200: {
      description: 'Job fetched with events',
      content: {
        'application/json': {
          schema: createSuccessEnvelope(
            jobRecordSchema.extend({
              events: z.array(jobEventSchema),
            })
          ),
        },
      },
    },
    404: {
      description: 'Job not found',
      content: {
        'application/json': {
          schema: errorEnvelopeSchema,
        },
      },
    },
  },
});

/**
 * =========================
 * DELETE /jobs/{id}
 * =========================
 */
registry.registerPath({
  method: 'delete',
  path: `${basePath}/jobs/{id}`,
  tags: ['Jobs'],
  summary: 'Cancel a job',

  request: {
    params: z.object({
      id: z.uuid(),
    }),
  },

  responses: {
    200: {
      description: 'Job cancelled',
      content: {
        'application/json': {
          schema: createSuccessEnvelope(jobRecordSchema),
        },
      },
    },
    404: {
      description: 'Job not found',
      content: {
        'application/json': {
          schema: errorEnvelopeSchema,
        },
      },
    },
  },
});
