import { randomUUID } from 'node:crypto';

import { withTransaction } from '@/database/client';

import type { JobRepository } from '@/repositories/job.repository';
import type { JobEventRepository } from '@/repositories/job-event.repository';
import { OutboxRepository } from '@/repositories/outbox.repository';
import type { ListJobsFilters, ListJobsPagination } from '@/repositories/job.repository';

import type {
  CreateJobInput,
  JobRecord,
  JobType,
  JobWithEvents,
  ListJobsResponse,
} from '@/api/schemas/job.schema';
import { ConflictError, NotFoundError } from '@/api/errors/app-error';
import { config } from '@/config';
import { logger } from '@/core/logger';
import { removeQueuedJob } from '@/core/queue/queue.producer';

const serializeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: 'Unknown error', error };
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
          payload: { jobId, ...input },
        },
        client
      );

      return created;
    });
  }

  public async getJob(jobId: string): Promise<JobRecord> {
    const job = await this.jobRepository.getById(jobId);
    if (!job) throw new NotFoundError(`Job ${jobId} not found`);
    return job;
  }

  public async getJobWithEvents(jobId: string): Promise<JobWithEvents> {
    // Run both queries in parallel — they're independent reads
    const [job, events] = await Promise.all([
      this.jobRepository.getById(jobId),
      this.eventRepository.findByJobId(jobId),
    ]);

    if (!job) throw new NotFoundError(`Job ${jobId} not found`);

    return { ...job, events };
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

  public async listJobs(
    filters: ListJobsFilters,
    pagination: ListJobsPagination
  ): Promise<ListJobsResponse> {
    const { jobs, total } = await this.jobRepository.findAll(filters, pagination);

    return {
      jobs,
      pagination: {
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: Math.ceil(total / pagination.limit),
      },
    };
  }

  public async cancelJob(jobId: string): Promise<JobRecord> {
    const job = await this.jobRepository.getById(jobId);
    if (!job) throw new NotFoundError(`Job ${jobId} not found`);

    if (job.status !== 'queued') {
      throw new ConflictError(
        `Cannot cancel job with status '${job.status}'. Only queued jobs can be cancelled.`,
        { jobId }
      );
    }

    return withTransaction(async (client) => {
      // Optimistic DB lock — returns null if job moved out of 'queued' during this request
      const cancelled = await this.jobRepository.cancel(jobId, client);
      if (!cancelled) {
        throw new ConflictError(
          `Job ${jobId} could not be cancelled — it was picked up by a worker. ` +
            `Check GET /jobs/${jobId} for current status.`,
          { jobId }
        );
      }

      // Best-effort BullMQ removal — job may have already been dequeued
      const removedFromQueue = await removeQueuedJob(jobId);
      if (!removedFromQueue) {
        logger.warn(
          { jobId },
          'Job was cancelled in DB but not found in BullMQ — worker will skip it via status check'
        );
      }

      await this.eventRepository.create(
        jobId,
        'cancelled',
        'Job cancelled by user',
        undefined,
        client
      );

      logger.info({ jobId, type: cancelled.type }, 'Job cancelled');
      return cancelled;
    });
  }

  public async onJobCompleted(
    jobId: string,
    type: JobType,
    result: Record<string, unknown>,
    durationMs: number
  ): Promise<void> {
    await withTransaction(async (client) => {
      await this.jobRepository.updateState(
        { id: jobId, status: 'completed', result, error: null, completedAt: nowIso() },
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
    logger.info({ jobId, type, durationMs }, 'Job completed');
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
        { attempts, maxAttempts, error: serialized },
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
    });

    logger.info({ jobId, type, durationMs, isTerminal }, 'Job failed');
  }

  public async onJobStalled(jobId: string): Promise<void> {
    await this.eventRepository.create(jobId, 'retrying', 'Job stalled');
  }
}
