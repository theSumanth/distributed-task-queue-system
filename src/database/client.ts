import { Pool, type PoolClient, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

import { config } from '@/config';
import {
  registerDbPoolStatsProvider,
  startDbQueryTimer,
  startDbTransactionTimer,
} from '@/core/metrics';

interface Queryable {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ) => Promise<QueryResult<T>>;
}

const createPool = (): Pool => {
  const baseConfig = {
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  } satisfies PoolConfig;

  if (config.database.url) {
    return new Pool({
      connectionString: config.database.url,
      ...baseConfig,
    });
  }

  return new Pool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
    ssl: config.database.sslEnabled ? { rejectUnauthorized: false } : undefined,
    ...baseConfig,
  });
};

export const dbPool = createPool();

registerDbPoolStatsProvider(() => ({
  total: dbPool.totalCount,
  idle: dbPool.idleCount,
  waiting: dbPool.waitingCount,
}));

dbPool.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

export const executeInstrumentedQuery = async <T extends QueryResultRow = QueryResultRow>(
  executor: Queryable,
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> => {
  const finish = startDbQueryTimer(text);

  try {
    const result = await executor.query<T>(text, values);
    finish('success');
    return result;
  } catch (error) {
    finish('error');
    throw error;
  }
};

const createInstrumentedClient = (client: PoolClient): PoolClient => {
  const query = <T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>> => executeInstrumentedQuery<T>(client as Queryable, text, values);

  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === 'query') return query;

      const value = Reflect.get(target, property, receiver);
      if (typeof value === 'function') return value.bind(target);
      return value;
    },
  });
};

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> => executeInstrumentedQuery<T>(dbPool as Queryable, text, values);

export const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await dbPool.connect();
  const instrumentedClient = createInstrumentedClient(client);
  const finishTransaction = startDbTransactionTimer();

  try {
    await instrumentedClient.query('BEGIN');
    const result = await fn(instrumentedClient);
    await instrumentedClient.query('COMMIT');
    finishTransaction('commit');
    return result;
  } catch (error) {
    try {
      await instrumentedClient.query('ROLLBACK');
    } finally {
      finishTransaction('rollback');
    }
    throw error;
  } finally {
    client.release();
  }
};

export const pingDatabase = async (): Promise<void> => {
  await query('SELECT 1');
};

export const closeDbPool = async (): Promise<void> => {
  await dbPool.end();
};
