import { setTimeout as sleep } from 'node:timers/promises';
import type { JobType } from '@/types/job';

export interface ProcessorContext {
  jobId: string;
  attempt: number;
}

export type ProcessorHandler = (
  payload: Record<string, unknown>,
  context: ProcessorContext
) => Promise<Record<string, unknown>>;

type ProcessorMap = Record<JobType, ProcessorHandler>;

const emailHandler: ProcessorHandler = async (payload, context) => {
  await sleep(100);

  return {
    message: 'email sent',
    jobId: context.jobId,
    attempt: context.attempt,
  };
};

const webhookHandler: ProcessorHandler = async (payload, context) => {
  await sleep(100);

  return {
    message: 'webhook called',
    jobId: context.jobId,
    attempt: context.attempt,
  };
};

const genericHandler: ProcessorHandler = async (payload, context) => {
  await sleep(50);

  return {
    echo: payload,
    jobId: context.jobId,
    attempt: context.attempt,
  };
};

export class ProcessorRegistry {
  private readonly processors: ProcessorMap;

  constructor(processors: ProcessorMap) {
    this.processors = processors;
  }

  public async execute(
    type: JobType,
    payload: Record<string, unknown>,
    context: ProcessorContext
  ): Promise<Record<string, unknown>> {
    const processor = this.processors[type];

    if (!processor) {
      throw new Error(`No processor found for job type: ${type}`);
    }

    return processor(payload, context);
  }
}

export const processorRegistry = new ProcessorRegistry({
  email: emailHandler,
  webhook: webhookHandler,
  generic: genericHandler,
});
