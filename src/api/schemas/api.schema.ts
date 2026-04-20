import { z } from 'zod';

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export const createSuccessEnvelope = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    success: z.literal(true),
    data: schema,
    error: z.null(),
    correlationId: z.string(),
    timestamp: z.string(),
  });

export const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  data: z.null(),
  error: apiErrorSchema,
  correlationId: z.string(),
  timestamp: z.string(),
});
