import { randomUUID } from 'node:crypto';

import type { JobRepository } from '@/repositories/job.repository';
import type { CreateJobInput, JobRecord } from '@/types/job';
import type { JobEventRepository } from '@/repositories/job-event.repository';

export class JobService {
  private readonly jobRepository: JobRepository;
  private readonly eventRepository: JobEventRepository;

  public constructor(jobRepository: JobRepository, eventRepository: JobEventRepository) {
    this.jobRepository = jobRepository;
    this.eventRepository = eventRepository;
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

    await this.eventRepository.create(jobId, 'queued', 'Job queued');

    try {
      // enqueue job
    } catch {
      // handle error
    }

    return created;
  }
}
