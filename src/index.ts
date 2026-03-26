import { logger } from './core/logger.js';
import { app } from './api/app.js';

app.listen(8080, () => {
  logger.info('====================================');
  logger.info('listening on port 8080');
  logger.info('====================================');
});
