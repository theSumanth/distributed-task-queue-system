import { Router } from 'express';

import { jobsController } from '../controllers';
import { validate } from '../middlewares/validate';
import { createJobSchema, getJobQuerySchema, listJobsQuerySchema } from '../schemas/job.schema';

const jobsRouter = Router();

jobsRouter.post('/', validate(createJobSchema, 'body'), jobsController.createJob);

jobsRouter.get('/', validate(listJobsQuerySchema, 'query'), jobsController.listJobs);

jobsRouter.get('/:id', validate(getJobQuerySchema, 'params'), jobsController.getJob);

export { jobsRouter };
