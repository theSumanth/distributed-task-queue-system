import z from 'zod';

import { booleanFromEnv } from './helpers/boolean';

const redisSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),

    REDIS_URL: z.string().optional(),
    REDIS_HOST: z.string().default('127.0.0.1'),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    REDIS_TLS_ENABLED: booleanFromEnv.default(false),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.REDIS_URL) {
      ctx.addIssue({
        code: 'custom',
        message: 'REDIS_URL is required in production',
      });
    }

    if (env.REDIS_URL) {
      try {
        new URL(env.REDIS_URL);
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid REDIS_URL',
        });
      }
      return;
    }

    const requiredFields = [env.REDIS_PORT, env.REDIS_HOST];

    if (requiredFields.some((field) => !field)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Incomplete Redis configuration',
      });
    }
  });

export const parseRedisConfig = (env: NodeJS.ProcessEnv) => {
  return redisSchema.parse(env);
};
