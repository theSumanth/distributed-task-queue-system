import { z } from 'zod';

export const healthSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

export const healthDetailedSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),

  dependencies: z.object({
    database: z.enum(['up', 'down']),
    redis: z.enum(['up', 'down']),
  }),
});
