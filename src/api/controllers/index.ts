import { jobService } from '@/services';
import { JobsController } from './jobs.controller';

export const jobsController = new JobsController(jobService);
