import type { PoolClient } from 'pg';

import type { JobEventRecord, JobStatus } from '@/api/schemas/job.schema';
import { createExecutor } from '@/database/types';

interface JobEventRow {
  id: number;
  job_id: string;
  status: JobStatus;
  message: string;
  details: Record<string, unknown> | null;
  created_at: Date;
}

const mapRowDto = (row: JobEventRow): JobEventRecord => ({
  id: row.id,
  jobId: row.job_id,
  status: row.status,
  message: row.message,
  details: row.details,
  createdAt: row.created_at.toISOString(),
});

export class JobEventRepository {
  public async create(
    jobId: string,
    status: JobStatus,
    message: string,
    details?: Record<string, unknown>,
    client?: PoolClient
  ): Promise<JobEventRecord> {
    const executor = createExecutor(client);

    const result = await executor.query<JobEventRow>(
      `
    INSERT INTO job_events (job_id, status, message, details)
    VALUES ($1,$2,$3,$4)
    RETURNING *
    `,
      [jobId, status, message, details ?? null]
    );

    const row = result.rows.at(0);
    if (!row) {
      throw new Error('Failed to insert job event');
    }

    return mapRowDto(row);
  }

  public async findByJobId(jobId: string, client?: PoolClient): Promise<JobEventRecord[]> {
    const executor = createExecutor(client);

    const result = await executor.query<JobEventRow>(
      `
        SELECT * FROM job_events
        WHERE job_id = $1
        ORDER BY created_at ASC
      `,
      [jobId]
    );

    const rows = result.rows;
    if (!rows) {
      throw new Error('Failed to fetch job events');
    }

    return rows.map(mapRowDto);
  }
}
