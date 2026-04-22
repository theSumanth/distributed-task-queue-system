import type { Request, Response, NextFunction } from 'express';

import type { JobService } from '@/services/job.service';
import type { CreateJobInput, ListJobsQuery } from '@/api/schemas/job.schema';
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
      const job = await this.jobService.createJob(req.body);
      sendSuccess(res, 201, job);
    } catch (error) {
      next(error);
    }
  };

  public getJob = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const job = await this.jobService.getJobWithEvents(req.params.id);
      sendSuccess(res, 200, job);
    } catch (error) {
      next(error);
    }
  };

  public listJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, type, page, limit } = req.query as unknown as ListJobsQuery;
      const result = await this.jobService.listJobs({ status, type }, { page, limit });
      sendSuccess(res, 200, result);
    } catch (error) {
      next(error);
    }
  };

  public cancelJob = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const job = await this.jobService.cancelJob(req.params.id);
      sendSuccess(res, 200, job);
    } catch (error) {
      next(error);
    }
  };
}
