import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from './openapi.registry';

// IMPORTANT: import modules (this registers routes)
import './jobs.openapi';
import './health.openapi';

export const generateOpenAPIDocument = () => {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Distributed Task Queue API',
      version: '1.0.0',
      description: 'Production-grade distributed job queue system',
    },
    servers: [{ url: '/' }],
  });
};
