import { setTimeout as sleep } from 'node:timers/promises';

import { enqueueJob } from '@/core/queue/queue.producer';
import { outboxJobEnqueueSchema } from '@/api/schemas/job.schema';
import { outboxRepository } from '@/repositories';

const POLL_INTERVAL_MS = 2000;
const BATCH_SIZE = 10;

const processOutbox = async (): Promise<void> => {
  const events = await outboxRepository.getPending(BATCH_SIZE);

  for (const event of events) {
    try {
      if (event.type === 'job.enqueue') {
        const payload = outboxJobEnqueueSchema.parse(event.payload);

        await enqueueJob(payload.jobId, {
          ...payload,
          priority: payload.priority ?? 'normal',
          delayMs: payload.delayMs ?? 0,
          maxRetries: payload.maxRetries ?? 3,
        });
      }

      await outboxRepository.markProcessed(event.id);
    } catch (error) {
      await outboxRepository.incrementAttempts(event.id);

      console.error('[Outbox Worker] Failed event', {
        eventId: event.id,
        error,
      });
    }
  }
};

const start = async (): Promise<void> => {
  console.log('[Outbox Worker] started');

  while (true) {
    try {
      await processOutbox();
    } catch (error) {
      console.error('[Outbox Worker] loop error', error);
    }

    await sleep(POLL_INTERVAL_MS);
  }
};

void start();
