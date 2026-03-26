import { query } from '@/database/client';
import type { JobEventRecord, JobStatus } from '@/types/job';

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
    details?: Record<string, unknown>
  ): Promise<JobEventRecord> {
    const result = await query<JobEventRow>(
      `
        INSERT INTO job_events (job_id, status, message, details)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [jobId, status, message, details ?? null]
    );

    const row = result.rows.at(0);
    if (!row) {
      throw new Error('Faiiled to insert job event');
    }

    return mapRowDto(row);
  }
}
