import { config } from '@/config';
import { startQueueOperationTimer } from '@/core/metrics';
import { getMainQueue, getDeadLetterQueue, queueNames } from './queue.factory';

import type { CreateJobInput, JobPriority, QueueJobPayload } from '@/api/schemas/job.schema';

const priorityToBullValue = (priority: JobPriority): number => {
  switch (priority) {
    case 'high':
      return 1;
    case 'normal':
      return 5;
    case 'low':
      return 10;
    default:
      return 5;
  }
};

export const enqueueJob = async (
  jobId: string,
  input: CreateJobInput & {
    priority: JobPriority;
    delayMs: number;
    maxRetries?: number;
  }
): Promise<void> => {
  const finish = startQueueOperationTimer(queueNames.main, 'enqueue');
  const runAtMs = input.runAt ? new Date(input.runAt).getTime() : undefined;
  const now = Date.now();

  const runAtDelayMs =
    typeof runAtMs === 'number' && !Number.isNaN(runAtMs) && runAtMs > now ? runAtMs - now : 0;

  const delay = Math.max(input.delayMs, runAtDelayMs);

  try {
    await getMainQueue().add(
      input.type,
      {
        jobId,
        type: input.type,
        payload: input.payload,
        maxRetries: input.maxRetries ?? config.queue.maxRetries,
      },
      {
        jobId,

        attempts: (input.maxRetries ?? config.queue.maxRetries) + 1,

        backoff: {
          type: config.queue.backoff.type,
          delay: config.queue.backoff.delayMs,
        },

        priority: priorityToBullValue(input.priority),

        delay,

        removeOnComplete: config.queue.removeOnComplete,
        removeOnFail: config.queue.removeOnFail,
      }
    );
    finish('success');
  } catch (error) {
    finish('error');
    throw error;
  }
};

export const enqueueDeadLetter = async (payload: QueueJobPayload): Promise<void> => {
  const finish = startQueueOperationTimer(queueNames.deadLetter, 'enqueue_dead_letter');

  try {
    await getDeadLetterQueue().add(payload.type, payload, {
      jobId: payload.jobId,
      removeOnComplete: config.queue.removeOnComplete,
      removeOnFail: config.queue.removeOnFail,
    });
    finish('success');
  } catch (error) {
    finish('error');
    throw error;
  }
};

export const removeQueuedJob = async (jobId: string): Promise<boolean> => {
  const finish = startQueueOperationTimer(queueNames.main, 'remove');

  try {
    const job = await getMainQueue().getJob(jobId);
    if (!job) {
      finish('not_found');
      return false;
    }
    await job.remove();
    finish('success');
    return true;
  } catch (error) {
    finish('error');
    throw error;
  }
};
