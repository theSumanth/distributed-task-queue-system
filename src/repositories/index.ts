import { JobEventRepository } from './job-event.repository';
import { JobRepository } from './job.repository';
import { OutboxRepository } from './outbox.repository';

export const jobRepository = new JobRepository();
export const jobEventRepository = new JobEventRepository();
export const outboxRepository = new OutboxRepository();
