import type { PoolClient } from 'pg';

import { createExecutor } from '@/database/types';

export interface OutboxEvent {
  id: number;
  aggregate_id: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processed' | 'failed';
  attempts: number;
  created_at: Date;
}

export class OutboxRepository {
  public async create(
    input: {
      aggregateId: string;
      type: string;
      payload: Record<string, unknown>;
    },
    client?: PoolClient
  ): Promise<void> {
    const executor = createExecutor(client);

    await executor.query(
      `
      INSERT INTO outbox_events (aggregate_id, type, payload)
      VALUES ($1, $2, $3)
      `,
      [input.aggregateId, input.type, input.payload]
    );
  }

  public async getPendingWithLock(limit = 10, client?: PoolClient): Promise<OutboxEvent[]> {
    const executor = createExecutor(client);

    const result = await executor.query<OutboxEvent>(
      `
      SELECT *
      FROM outbox_events
      WHERE status = 'pending'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT $1
      `,
      [limit]
    );

    return result.rows;
  }

  public async markProcessed(id: number, client?: PoolClient): Promise<void> {
    const executor = createExecutor(client);

    await executor.query(
      `
      UPDATE outbox_events
      SET status = 'processed', processed_at = NOW()
      WHERE id = $1
      `,
      [id]
    );
  }

  public async markFailedWithAttempts(
    id: number,
    attempts: number,
    maxAttempts: number,
    error?: unknown,
    client?: PoolClient
  ): Promise<void> {
    const executor = createExecutor(client);

    const status = attempts >= maxAttempts ? 'failed' : 'pending';

    await executor.query(
      `
      UPDATE outbox_events
      SET attempts = $2,
          status = $3,
          last_error = $4
      WHERE id = $1
      `,
      [id, attempts, status, error ? String(error) : null]
    );
  }
}
