import z from 'zod';

import { booleanFromEnv } from './helpers/boolean';

const databaseSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

    DATABASE_URL: z.string().optional(),

    DB_HOST: z.string().default('127.0.0.1'),
    DB_PORT: z.coerce.number().int().positive().default(5432),
    DB_NAME: z.string().default('task_queue'),
    DB_USER: z.string().default('postgres'),
    DB_PASSWORD: z.string().default('postgres'),

    DB_SSL_ENABLED: booleanFromEnv.default(false),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.DATABASE_URL) {
      ctx.addIssue({
        code: 'custom',
        message: 'DATABASE_URL is required in production',
      });
    }

    if (env.DATABASE_URL) {
      try {
        new URL(env.DATABASE_URL);
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid DATABASE_URL',
        });
      }
      return;
    }

    const requiredFields = [env.DB_HOST, env.DB_PORT, env.DB_NAME, env.DB_USER, env.DB_PASSWORD];

    if (requiredFields.some((field) => !field)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Incomplete DB configuration',
      });
    }
  });

export const parseDatabaseConfig = (env: NodeJS.ProcessEnv) => {
  return databaseSchema.parse(env);
};
