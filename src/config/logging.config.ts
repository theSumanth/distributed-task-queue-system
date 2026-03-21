import { z } from 'zod';

const loggingSchema = z.object({
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
});

export const parseLoggingConfig = (env: NodeJS.ProcessEnv) => {
  return loggingSchema.parse(env);
};
