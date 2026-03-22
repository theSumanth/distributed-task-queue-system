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
