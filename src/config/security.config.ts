import { z } from 'zod';

const securitySchema = z.object({
  RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().positive().default(100),
  CORS_ORIGIN: z.string().nonempty().default('http://localhost:3000'),
});

export const parseSecurityConfig = (env: NodeJS.ProcessEnv) => {
  return securitySchema.parse(env);
};
