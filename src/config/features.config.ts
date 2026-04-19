import z from 'zod';
import { booleanFromEnv } from './helpers/boolean';

export const featuresSchema = z.object({
  ENABLE_DEAD_LETTER_QUEUE: booleanFromEnv.default(true),
  ENABLE_SCHEDULED_JOBS: booleanFromEnv.default(true),
});

export const parseFeaturesConfig = (env: NodeJS.ProcessEnv) => {
  return featuresSchema.parse(env);
};
