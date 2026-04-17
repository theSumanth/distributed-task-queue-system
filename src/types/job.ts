export type JobType = 'email' | 'webhook' | 'generic';
export type JobPriority = 'high' | 'normal' | 'low';
export type JobStatus =
  | 'queued'
  | 'active'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'dead_letter'
  | 'cancelled';

export interface CreateJobInput {
  type: JobType;
  payload: Record<string, unknown>;
  priority?: JobPriority;
  delayMs?: number;
  runAt?: string;
  cron?: string;
  maxRetries?: number;
}

export interface JobRecord {
  id: string;
  queueJobId: string | null;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  attempts: number;
  maxRetries: number;
  delayMs: number;
  runAt: string | null;
  cron: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
}

export interface JobEventRecord {
  id: number;
  jobId: string;
  status: JobStatus;
  message: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface QueueJobPayload {
  jobId: string;
  type: JobType;
  payload: Record<string, unknown>;
  maxRetries: number;
}
