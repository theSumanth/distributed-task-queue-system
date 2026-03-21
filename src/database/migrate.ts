import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { closeDbPool, query, withTransaction } from './client';
import { logger } from '@/core/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, 'migrations');

interface MigrationRow {
  version: string;
}

const ensureMigrationsTable = async (): Promise<void> => {
  await query(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPZ NOT NULL DEFAULT NOW()
		)
  `);
};

const getAllMigrationsFiles = async (): Promise<string[]> => {
  const files = await fs.readdir(migrationsDir);
  return files.filter((file) => file.endsWith('.up.sql')).sort((a, b) => a.localeCompare(b));
};

const getAppliedMigrationVersions = async (): Promise<Set<string>> => {
  const result = await query<MigrationRow>(
    `SELECT version FROM schema_migrations ORDER BY version ASC`
  );

  return new Set(result.rows.map((row) => row.version));
};

const migrationVersionFromFile = (filename: string): string => filename.replace(/\.up\.sql$/u, '');

const applyMigration = async (filename: string): Promise<void> => {
  const version = migrationVersionFromFile(filename);
  const fullPath = path.join(migrationsDir, filename);
  const sql = await fs.readFile(fullPath, 'utf-8');

  await withTransaction(async (client) => {
    await client.query(sql);
    await client.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [version]);
  });
};

export const migrateUp = async (): Promise<void> => {
  await ensureMigrationsTable();
  const [allFiles, appliedVersions] = await Promise.all([
    getAllMigrationsFiles(),
    getAppliedMigrationVersions(),
  ]);

  const pending = allFiles.filter((file) => !appliedVersions.has(migrationVersionFromFile(file)));
  for (const migrationFile of pending) {
    await applyMigration(migrationFile);
    logger.info(`Applied Migration: ${migrationFile}`);
  }

  if (pending.length === 0) {
    logger.info('No pending migrations');
  }
};

const main = async (): Promise<void> => {
  const direction = process.argv[2];
  if (direction !== 'up' && direction !== 'down') {
    throw new Error('Usage: tsx src/database/migrate.ts <up|down>');
  }

  try {
    if (direction === 'up') {
      await migrateUp();
    } else {
      // migrate down
    }
  } finally {
    await closeDbPool();
  }
};

void main().catch((error) => {
  logger.error('Failed to do migrations', error);
  process.exit(1);
});
