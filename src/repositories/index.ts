import { JobEventRepository } from './job-event.repository';
import { JobRepository } from './job.repository';

export const jobRepository = new JobRepository();
export const jobEventRepository = new JobEventRepository();
