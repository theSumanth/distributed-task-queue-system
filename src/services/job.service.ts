import { randomUUID } from 'node:crypto';
import { withTransaction } from '@/database/client';

import type { JobRepository } from '@/repositories/job.repository';
import type { JobEventRepository } from '@/repositories/job-event.repository';
import { OutboxRepository } from '@/repositories/outbox.repository';

import type { CreateJobInput, JobRecord, JobType } from '@/api/schemas/job.schema';
import { NotFoundError } from '@/api/errors/app-error';
import { config } from '@/config';
import { logger } from '@/core/logger';

const serializeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return {
    message: 'Unknown error',
    error,
  };
};

const nowIso = (): string => new Date().toISOString();

export class JobService {
  private readonly jobRepository: JobRepository;
  private readonly eventRepository: JobEventRepository;
  private readonly outboxRepository: OutboxRepository;

  public constructor(
    jobRepository: JobRepository,
    eventRepository: JobEventRepository,
    outboxRepository: OutboxRepository
  ) {
    if (!jobRepository || !eventRepository || !outboxRepository) {
      throw new Error('Missing dependencies in JobService');
    }
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

  public async getJob(jobId: string): Promise<JobRecord> {
    const job = await this.jobRepository.getById(jobId);
    if (!job) {
      throw new NotFoundError(`Job ${jobId} not found`);
    }
    return job;
  }

  public async onJobActive(jobId: string, attempts: number): Promise<void> {
    // const job = await this.getJob(jobId);
    await this.jobRepository.updateState({
      id: jobId,
      status: 'active',
      attempts,
      startedAt: nowIso(),
    });
    await this.eventRepository.create(jobId, 'active', 'Job started', { attempts });
  }

  public async onJobCompleted(
    jobId: string,
    type: JobType,
    result: Record<string, unknown>,
    durationMs: number
  ): Promise<void> {
    await withTransaction(async (client) => {
      await this.jobRepository.updateState(
        {
          id: jobId,
          status: 'completed',
          result,
          error: null,
          completedAt: nowIso(),
        },
        client
      );
      await this.eventRepository.create(
        jobId,
        'completed',
        'Job completed',
        { durationMs },
        client
      );
    });
    logger.info({ type }, 'job completed');
  }

  public async onJobFailed(
    jobId: string,
    type: JobType,
    attempts: number,
    maxAttempts: number,
    error: unknown,
    durationMs: number
  ): Promise<void> {
    const serialized = serializeError(error);
    const isTerminal = attempts >= maxAttempts;
    const status = isTerminal ? 'dead_letter' : 'retrying';

    await withTransaction(async (client) => {
      const updated = await this.jobRepository.updateState(
        {
          id: jobId,
          status,
          attempts,
          error: serialized,
          failedAt: isTerminal ? nowIso() : null,
        },
        client
      );

      await this.eventRepository.create(
        jobId,
        status,
        `Job ${isTerminal ? 'failed permanently' : 'retrying'}`,
        {
          attempts,
          maxAttempts,
          error: serialized,
        },
        client
      );

      if (isTerminal && updated && config.features.deadLetterQueue) {
        await this.outboxRepository.create(
          {
            aggregateId: jobId,
            type: 'job.dead_letter',
            payload: {
              jobId,
              type: updated.type,
              payload: updated.payload,
              maxRetries: updated.maxRetries,
            },
          },
          client
        );
      }

      logger.info({ type, durationMs }, 'job failed');
    });
  }

  public async onJobStalled(jobId: string): Promise<void> {
    await this.eventRepository.create(jobId, 'retrying', 'Job stalled');
  }
}
