import { randomUUID } from 'node:crypto';
import { withTransaction } from '@/database/client';

import type { JobRepository } from '@/repositories/job.repository';
import type { JobEventRepository } from '@/repositories/job-event.repository';
import { OutboxRepository } from '@/repositories/outbox.repository';

import type { CreateJobInput, JobRecord } from '@/types/job';

export class JobService {
  private readonly jobRepository: JobRepository;
  private readonly eventRepository: JobEventRepository;
  private readonly outboxRepository: OutboxRepository;

  public constructor(
    jobRepository: JobRepository,
    eventRepository: JobEventRepository,
    outboxRepository: OutboxRepository
  ) {
    this.jobRepository = jobRepository;
    this.eventRepository = eventRepository;
    this.outboxRepository = outboxRepository;
  }

  public async createJob(input: CreateJobInput): Promise<JobRecord> {
    const jobId = randomUUID();

    return withTransaction(async (client) => {
      const created = await this.jobRepository.create(
        {
          id: jobId,
          type: input.type,
          status: 'queued',
          payload: input.payload,
          priority: input.priority ?? 'normal',
          delayMs: input.delayMs ?? 0,
          maxRetries: input.maxRetries ?? 3,
          runAt: input.runAt ?? null,
          cron: input.cron ?? null,
        },
        client
      );

      await this.eventRepository.create(jobId, 'queued', 'Job queued', undefined, client);

      await this.outboxRepository.create(
        {
          aggregateId: jobId,
          type: 'job.enqueue',
          payload: {
            jobId,
            ...input,
          },
        },
        client
      );

      return created;
    });
  }
}
