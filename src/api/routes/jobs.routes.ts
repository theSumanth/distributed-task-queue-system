import { Router } from 'express';
import { jobsController } from '../controllers';

const jobsRouter = Router();

jobsRouter.post('/', jobsController.createJob);

export { jobsRouter };
