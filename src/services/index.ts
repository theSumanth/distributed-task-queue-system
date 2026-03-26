import { jobRepository } from '@/repositories';
import { JobService } from './job.service';

export const jobService = new JobService(jobRepository);
