import { Queue } from 'bullmq';

import { config } from '@/config';
import { getRedisConnection } from './redis.connection';
import type { QueueJobPayload } from '@/types/job';

let mainQueue: Queue<QueueJobPayload> | null = null;
let deadLetterQueue: Queue<QueueJobPayload> | null = null;

export const getMainQueue = (): Queue<QueueJobPayload> => {
  if (!mainQueue) {
    mainQueue = new Queue<QueueJobPayload>(config.queue.name, {
      connection: getRedisConnection(),
    });
  }

  return mainQueue;
};

export const getDeadLetterQueue = (): Queue<QueueJobPayload> => {
  if (!deadLetterQueue) {
    deadLetterQueue = new Queue<QueueJobPayload>(`${config.queue.name}_dead_letter`, {
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
