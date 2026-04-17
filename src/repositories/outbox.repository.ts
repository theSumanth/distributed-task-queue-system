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

  public async getPending(limit = 10): Promise<OutboxEvent[]> {
    const executor = createExecutor();

    const result = await executor.query<OutboxEvent>(
      `
      SELECT *
      FROM outbox_events
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT $1
      `,
      [limit]
    );

    return result.rows;
  }

  public async markProcessed(id: number): Promise<void> {
    const executor = createExecutor();

    await executor.query(
      `
      UPDATE outbox_events
      SET status = 'processed', processed_at = NOW()
      WHERE id = $1
      `,
      [id]
    );
  }

  public async markFailed(id: number): Promise<void> {
    const executor = createExecutor();

    await executor.query(
      `
      UPDATE outbox_events
      SET status = 'failed'
      WHERE id = $1
      `,
      [id]
    );
  }

  public async incrementAttempts(id: number): Promise<void> {
    const executor = createExecutor();

    await executor.query(
      `
      UPDATE outbox_events
      SET attempts = attempts + 1
      WHERE id = $1
      `,
      [id]
    );
  }
}
