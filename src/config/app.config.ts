import z from 'zod';

const appSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
});

export const parseAppConfig = (env: NodeJS.ProcessEnv) => {
  return appSchema.parse(env);
};
