import { Router } from 'express';
import { jobsController } from '../controllers';
import { validate } from '../middlewares/validate';
import { createJobSchema } from '../schemas/job.schema';

const jobsRouter = Router();

jobsRouter.post('/', validate(createJobSchema, 'body'), jobsController.createJob);

export { jobsRouter };
