import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(8080),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().positive().default(100),

  CORS_ORIGIN: z.string().nonempty().default("http://localhost:3000"),
});

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Invalid environment variables:");
      console.error(z.treeifyError(error).errors);
      process.exit(1);
    }

    throw error;
  }
};

const env = parseEnv();

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,

  security: {
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    corsOrigin: env.CORS_ORIGIN,
  },

  isDevelopment: env.NODE_ENV === "development",
  isStaging: env.NODE_ENV === "staging",
  isProduction: env.NODE_ENV === "production",
} as const;

export type Config = typeof config;
