import type { Request, Response, NextFunction } from 'express';

import type { JobService } from '@/services/job.service';
import type { CreateJobInput } from '@/types/job';
import { sendSuccess } from '../utils/response';

export class JobsController {
  private readonly jobService: JobService;

  public constructor(jobService: JobService) {
    this.jobService = jobService;
  }

  public createJob = async (
    req: Request<Record<string, never>, null, CreateJobInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const input = req.body;
      const job = await this.jobService.createJob(input);
      sendSuccess(res, 201, job);
    } catch (error) {
      next(error);
    }
  };
}
