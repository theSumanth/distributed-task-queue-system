import { Router } from 'express';

import { jobsController } from '../controllers';
import { validate } from '../middlewares/validate';
import { createJobSchema, listJobsQuerySchema } from '../schemas/job.schema';

const jobsRouter = Router();

jobsRouter.post('/', validate(createJobSchema, 'body'), jobsController.createJob);

jobsRouter.get('/', validate(listJobsQuerySchema, 'query'), jobsController.listJobs);

export { jobsRouter };
