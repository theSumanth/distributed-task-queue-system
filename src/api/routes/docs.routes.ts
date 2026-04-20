import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenAPIDocument } from '@/api/docs/openapi.generator';

const docsRouter = Router();

const document = generateOpenAPIDocument();

docsRouter.get('/openapi.json', (_req, res) => {
  const freshDocument = generateOpenAPIDocument();

  res.type('application/json');
  res.send(freshDocument);
});

docsRouter.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(document, {
    explorer: true,
    customSiteTitle: 'Distributed Task Queue API Docs',
  })
);

export { docsRouter };
