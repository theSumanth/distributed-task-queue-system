import type { PoolClient } from 'pg';

import { createExecutor } from '@/database/types';

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
}
