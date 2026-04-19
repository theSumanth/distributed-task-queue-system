import { config } from '@/config';
import { getMainQueue, getDeadLetterQueue } from './queue.factory';

import type { CreateJobInput, JobPriority, QueueJobPayload } from '@/types/job';

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
    maxRetries: number;
  }
): Promise<void> => {
  const runAtMs = input.runAt ? new Date(input.runAt).getTime() : undefined;
  const now = Date.now();

  const runAtDelayMs =
    typeof runAtMs === 'number' && !Number.isNaN(runAtMs) && runAtMs > now ? runAtMs - now : 0;

  const delay = Math.max(input.delayMs, runAtDelayMs);

  await getMainQueue().add(
    input.type,
    {
      jobId,
      type: input.type,
      payload: input.payload,
      maxRetries: input.maxRetries,
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
};

export const enqueueDeadLetter = async (payload: QueueJobPayload): Promise<void> => {
  await getDeadLetterQueue().add(payload.type, payload, {
    jobId: payload.jobId,
    removeOnComplete: config.queue.removeOnComplete,
    removeOnFail: config.queue.removeOnFail,
  });
};

export const removeQueuedJob = async (jobId: string): Promise<void> => {
  const job = await getMainQueue().getJob(jobId);

  if (!job) return;

  await job.remove();
};
