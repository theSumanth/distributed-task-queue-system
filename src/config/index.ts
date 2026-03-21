import dotenv from 'dotenv';
import { z } from 'zod';

import { parseAppConfig } from './app.config';
import { parseSecurityConfig } from './security.config';
import { parseLoggingConfig } from './logging.config';
import { parseDatabaseConfig } from './database.config';

dotenv.config();

const parseConfig = () => {
  try {
    const app = parseAppConfig(process.env);
    const database = parseDatabaseConfig(process.env);
    const security = parseSecurityConfig(process.env);
    const logging = parseLoggingConfig(process.env);

    return { app, database, security, logging };
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Invalid environment variables:');
      console.error(z.treeifyError(error).errors);
      process.exit(1);
    }

    console.error(error);
    process.exit(1);
  }
};

const env = parseConfig();

export const config = {
  nodeEnv: env.app.NODE_ENV,
  port: env.app.PORT,

  database: {
    url: env.database.DATABASE_URL,
    host: env.database.DB_HOST,
    port: env.database.DB_PORT,
    name: env.database.DB_NAME,
    password: env.database.DB_PASSWORD,
    user: env.database.DB_USER,
    sslEnabled: env.database.DB_SSL_ENABLED,
  },

  security: {
    rateLimitWindowMs: env.security.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: env.security.RATE_LIMIT_MAX_REQUESTS,
    corsOrigin: env.security.CORS_ORIGIN,
  },

  logging: {
    level: env.logging.LOG_LEVEL,
    format: env.logging.LOG_FORMAT,
  },

  isDevelopment: env.app.NODE_ENV === 'development',
  isStaging: env.app.NODE_ENV === 'staging',
  isProduction: env.app.NODE_ENV === 'production',
} as const;

export const redactedConfig = {
  ...config,
  database: {
    ...config.database,
    password: config.database.password ? '***redacted***' : undefined,
  },
};

export type Config = typeof config;
