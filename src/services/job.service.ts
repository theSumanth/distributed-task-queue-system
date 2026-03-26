import { randomUUID } from 'node:crypto';

import type { JobRepository } from '@/repositories/job.repository';
import type { CreateJobInput, JobRecord } from '@/types/job';

export class JobService {
  private readonly jobRepository: JobRepository;

  public constructor(jobRepository: JobRepository) {
    this.jobRepository = jobRepository;
  }

  public async createJob(input: CreateJobInput): Promise<JobRecord> {
    const jobId = randomUUID();
    const priority = input.priority ?? 'normal';
    const delayMs = input.delayMs ?? 0;
    const maxRetries = input.maxRetries ?? 3;

    const created = await this.jobRepository.create({
      id: jobId,
      type: input.type,
      status: 'queued',
      payload: input.payload,
      priority: priority,
      delayMs: delayMs,
      maxRetries,
      runAt: input.runAt ?? null,
      cron: input.cron ?? null,
    });

    try {
      // enqueue job
    } catch {
      // handle error
    }

    return created;
  }
}
