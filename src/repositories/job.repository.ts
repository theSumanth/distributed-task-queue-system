import type { PoolClient } from 'pg';

import type { JobPriority, JobRecord, JobStatus, JobType } from '@/types/job';
import { createExecutor } from '@/database/types';

interface JobRow {
  id: string;
  queue_job_id: string | null;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  attempts: number;
  max_retries: number;
  delay_ms: number;
  run_at: Date | null;
  cron: string | null;
  created_at: Date;
  updated_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  failed_at: Date | null;
}

export interface CreateJobRecordInput {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  payload: Record<string, unknown>;
  maxRetries: number;
  delayMs: number;
  runAt: string | null;
  cron: string | null;
}

const mapRowDto = (row: JobRow): JobRecord => ({
  id: row.id,
  queueJobId: row.queue_job_id,
  type: row.type,
  status: row.status,
  priority: row.priority,
  payload: row.payload,
  result: row.result,
  error: row.result,
  attempts: row.attempts,
  maxRetries: row.max_retries,
  delayMs: row.delay_ms,
  runAt: row.run_at?.toISOString() ?? null,
  cron: row.cron ?? null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  startedAt: row.started_at?.toISOString() ?? null,
  completedAt: row.completed_at?.toISOString() ?? null,
  failedAt: row.failed_at?.toISOString() ?? null,
});

export class JobRepository {
  public async create(input: CreateJobRecordInput, client?: PoolClient): Promise<JobRecord> {
    const executor = createExecutor(client);

    const result = await executor.query<JobRow>(
      `
        INSERT INTO jobs (id, type, status, priority, payload, max_retries, delay_ms, run_at, cron)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        input.id,
        input.type,
        input.status,
        input.priority,
        input.payload,
        input.maxRetries,
        input.delayMs,
        input.runAt,
        input.cron,
      ]
    );

    const row = result.rows.at(0);
    if (!row) {
      throw new Error('Failed to create job record');
    }

    return mapRowDto(row);
  }
}
