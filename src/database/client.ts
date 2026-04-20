import { Pool, type PoolClient, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

import { config } from '@/config';

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

dbPool.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[]
): Promise<QueryResult<T>> => dbPool.query<T>(text, values);

export const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const pingDatabase = async (): Promise<void> => {
  await dbPool.query('SELECT 1');
};

export const closeDbPool = async (): Promise<void> => {
  await dbPool.end();
};
