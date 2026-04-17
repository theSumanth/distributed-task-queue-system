import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

import { query } from './client';

export interface QueryExecutor {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ) => Promise<QueryResult<T>>;
}

export const createExecutor = (client?: PoolClient): QueryExecutor => {
  if (client) {
    return client;
  }

  return {
    query: (text, values) => query(text, values),
  };
};
