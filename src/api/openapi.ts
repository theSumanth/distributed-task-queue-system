import { config } from '@/config';

const basePath = `/api/${config.apiVersion}`;

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Distributed Task Queue API',
    version: '1.0.0',
    description: 'API for submitting and managing distributed queue jobs',
  },

  servers: [
    {
      url: '/',
    },
  ],

  tags: [
    { name: 'Jobs', description: 'Job operations' },
    { name: 'Health', description: 'Health checks' },
  ],

  paths: {
    [`${basePath}/jobs`]: {
      post: {
        tags: ['Jobs'],
        summary: 'Create a new job',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateJob',
              },
            },
          },
        },
        responses: {
          '201': { description: 'Job created' },
        },
      },
    },

    [`${basePath}/jobs/{jobId}`]: {
      get: {
        tags: ['Jobs'],
        summary: 'Get job by id',
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': { description: 'Job details' },
        },
      },
    },

    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
      },
    },
  },

  components: {
    schemas: {
      CreateJob: {
        type: 'object',
        required: ['type', 'payload'],
        properties: {
          type: {
            type: 'string',
            enum: ['email', 'webhook', 'generic'],
          },
          payload: {
            type: 'object',
            additionalProperties: true,
          },
          priority: {
            type: 'string',
            enum: ['high', 'normal', 'low'],
          },
          delayMs: {
            type: 'integer',
          },
          maxRetries: {
            type: 'integer',
          },
        },
      },
    },
  },
};
