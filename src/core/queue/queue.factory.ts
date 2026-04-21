import { Queue } from 'bullmq';

import { config } from '@/config';
import { getRedisConnection } from './redis.connection';
import type { QueueJobPayload } from '@/api/schemas/job.schema';

let mainQueue: Queue<QueueJobPayload> | null = null;
let deadLetterQueue: Queue<QueueJobPayload> | null = null;

export const queueNames = {
  main: config.queue.name,
  deadLetter: `${config.queue.name}_dead_letter`,
} as const;

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
    await mainQueue.close();
    mainQueue = null;
  }
  if (deadLetterQueue) {
    await deadLetterQueue.close();
    deadLetterQueue = null;
  }
};
