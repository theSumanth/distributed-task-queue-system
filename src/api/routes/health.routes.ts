import { Router, type NextFunction, type Request, type Response } from 'express';

import { pingDatabase } from '@/database/client';
import { pingRedis } from '@/core/queue/redis.connection';

const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/detailed', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const checks = await Promise.allSettled([pingDatabase(), pingRedis()]);
    const dbHealthy = checks[0].status === 'fulfilled';
    const redisHealthy = checks[1].status === 'fulfilled';

    const healthy = dbHealthy && redisHealthy;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbHealthy ? 'up' : 'down',
        redis: redisHealthy ? 'up' : 'down',
      },
    });
  } catch (err) {
    next(err);
  }
});

export { healthRouter };
