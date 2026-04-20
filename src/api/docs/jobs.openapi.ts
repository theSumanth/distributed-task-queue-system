import { z } from 'zod';
import { registry } from '@/api/docs/openapi.registry';

import { createJobSchema, jobRecordSchema } from '@/api/schemas/job.schema';

import { createSuccessEnvelope, errorEnvelopeSchema } from '@/api/schemas/api.schema';
import { config } from '@/config';

const basePath = `/api/${config.apiVersion}`;

registry.register('CreateJob', createJobSchema);
registry.register('JobRecord', jobRecordSchema);

// POST /jobs
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

// GET /jobs/{jobId}
registry.registerPath({
  method: 'get',
  path: `${basePath}/jobs/{jobId}`,
  tags: ['Jobs'],
  summary: 'Get job by id',

  request: {
    params: z.object({
      jobId: z.uuid(),
    }),
  },

  responses: {
    200: {
      description: 'Job fetched',
      content: {
        'application/json': {
          schema: createSuccessEnvelope(jobRecordSchema),
        },
      },
    },
  },
});
