import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from '@/api/openapi';

const docsRouter = Router();

docsRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});

docsRouter.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    explorer: true,
    customSiteTitle: 'Distributed Task Queue API Docs',
  })
);

export { docsRouter };
