import { Counter, Gauge, Histogram } from 'prom-client';

import { elapsedSecondsSince, isMetricsEnabled, metricsRegistry } from './registry';

type DatabaseOutcome = 'success' | 'error';
type TransactionOutcome = 'commit' | 'rollback';

interface DbPoolStats {
  total: number;
  idle: number;
  waiting: number;
}

const knownOperations = new Set([
  'select',
  'insert',
  'update',
  'delete',
  'create',
  'alter',
  'drop',
  'begin',
  'commit',
  'rollback',
]);

const knownTables = ['jobs', 'job_events', 'outbox_events', 'schema_migrations'] as const;

let dbPoolStatsProvider: (() => DbPoolStats) | null = null;

const dbQueriesTotal = new Counter({
  name: 'task_queue_db_queries_total',
  help: 'Total PostgreSQL queries by normalized operation, table, and outcome.',
  labelNames: ['operation', 'table', 'outcome'] as const,
  registers: [metricsRegistry],
});

const dbQueryDurationSeconds = new Histogram({
  name: 'task_queue_db_query_duration_seconds',
  help: 'PostgreSQL query duration in seconds.',
  labelNames: ['operation', 'table', 'outcome'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

const dbTransactionsTotal = new Counter({
  name: 'task_queue_db_transactions_total',
  help: 'Total PostgreSQL transactions by outcome.',
  labelNames: ['outcome'] as const,
  registers: [metricsRegistry],
});

const dbTransactionDurationSeconds = new Histogram({
  name: 'task_queue_db_transaction_duration_seconds',
  help: 'PostgreSQL transaction duration in seconds.',
  labelNames: ['outcome'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

new Gauge({
  name: 'task_queue_db_pool_connections',
  help: 'PostgreSQL pool connection counts by state.',
  labelNames: ['state'] as const,
  registers: [metricsRegistry],
  collect() {
    if (!isMetricsEnabled() || !dbPoolStatsProvider) return;

    const stats = dbPoolStatsProvider();
    this.labels({ state: 'total' }).set(stats.total);
    this.labels({ state: 'idle' }).set(stats.idle);
    this.labels({ state: 'waiting' }).set(stats.waiting);
  },
});

const normalizeSql = (sql: string): string => sql.trim().replace(/\s+/gu, ' ').toLowerCase();

const classifyOperation = (normalizedSql: string): string => {
  const operation = normalizedSql.split(' ')[0] ?? 'unknown';
  return knownOperations.has(operation) ? operation : 'unknown';
};

const classifyTable = (normalizedSql: string, operation: string): string => {
  if (operation === 'begin' || operation === 'commit' || operation === 'rollback') return 'none';

  const table = knownTables.find((knownTable) => {
    return new RegExp(`\\b${knownTable}\\b`, 'u').test(normalizedSql);
  });

  return table ?? 'unknown';
};

export const registerDbPoolStatsProvider = (provider: () => DbPoolStats): void => {
  dbPoolStatsProvider = provider;
};

export const recordDbQuery = (
  sql: string,
  outcome: DatabaseOutcome,
  durationSeconds: number
): void => {
  if (!isMetricsEnabled()) return;

  const normalizedSql = normalizeSql(sql);
  const operation = classifyOperation(normalizedSql);
  const table = classifyTable(normalizedSql, operation);
  const labels = { operation, table, outcome };

  dbQueriesTotal.inc(labels);
  dbQueryDurationSeconds.observe(labels, durationSeconds);
};

export const startDbQueryTimer = (sql: string): ((outcome: DatabaseOutcome) => void) => {
  const startedAt = process.hrtime.bigint();
  return (outcome: DatabaseOutcome): void => {
    recordDbQuery(sql, outcome, elapsedSecondsSince(startedAt));
  };
};

export const recordDbTransaction = (outcome: TransactionOutcome, durationSeconds: number): void => {
  if (!isMetricsEnabled()) return;

  dbTransactionsTotal.inc({ outcome });
  dbTransactionDurationSeconds.observe({ outcome }, durationSeconds);
};

export const startDbTransactionTimer = (): ((outcome: TransactionOutcome) => void) => {
  const startedAt = process.hrtime.bigint();
  return (outcome: TransactionOutcome): void => {
    recordDbTransaction(outcome, elapsedSecondsSince(startedAt));
  };
};
