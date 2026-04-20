import { registry } from '@/api/docs/openapi.registry';

import { healthSchema, healthDetailedSchema } from '@/api/schemas/health.schema';

registry.register('Health', healthSchema);
registry.register('HealthDetailed', healthDetailedSchema);

// GET /health
registry.registerPath({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Basic liveness probe',

  responses: {
    200: {
      description: 'Service is alive',
      content: {
        'application/json': {
          schema: healthSchema,
        },
      },
    },
  },
});

// GET /health/detailed
registry.registerPath({
  method: 'get',
  path: '/health/detailed',
  tags: ['Health'],
  summary: 'Detailed health check with dependencies',

  responses: {
    200: {
      description: 'Detailed health status',
      content: {
        'application/json': {
          schema: healthDetailedSchema,
        },
      },
    },
  },
});
