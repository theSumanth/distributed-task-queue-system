import { Queue, type JobType as BullMqJobType } from 'bullmq';

import { config } from '@/config';
import { registerQueueDepthCollector, unregisterQueueDepthCollector } from '@/core/metrics';
import { getRedisConnection } from './redis.connection';
import type { QueueJobPayload } from '@/api/schemas/job.schema';

let mainQueue: Queue<QueueJobPayload> | null = null;
let deadLetterQueue: Queue<QueueJobPayload> | null = null;

export const queueNames = {
  main: config.queue.name,
  deadLetter: `${config.queue.name}_dead_letter`,
} as const;

const BULLMQ_JOB_COUNT_TYPES: BullMqJobType[] = [
  'waiting',
  'active',
  'delayed',
  'prioritized',
  'waiting-children',
  'completed',
  'failed',
  'paused',
  'repeat',
  'wait',
];

registerQueueDepthCollector(queueNames.main, () =>
  getMainQueue().getJobCounts(...BULLMQ_JOB_COUNT_TYPES)
);
registerQueueDepthCollector(queueNames.deadLetter, () =>
  getDeadLetterQueue().getJobCounts(...BULLMQ_JOB_COUNT_TYPES)
);

export const getMainQueue = (): Queue<QueueJobPayload> => {
  if (!mainQueue) {
    mainQueue = new Queue<QueueJobPayload>(queueNames.main, {
      connection: getRedisConnection(),
    });
  }
  return mainQueue;
};

export const getDeadLetterQueue = (): Queue<QueueJobPayload> => {
  if (!deadLetterQueue) {
    deadLetterQueue = new Queue<QueueJobPayload>(queueNames.deadLetter, {
      connection: getRedisConnection(),
    });
  }
  return deadLetterQueue;
};

export const closeQueues = async (): Promise<void> => {
  if (mainQueue) {
    unregisterQueueDepthCollector(queueNames.main);
    await mainQueue.close();
    mainQueue = null;
  }
  if (deadLetterQueue) {
    unregisterQueueDepthCollector(queueNames.deadLetter);
    await deadLetterQueue.close();
    deadLetterQueue = null;
  }
};
