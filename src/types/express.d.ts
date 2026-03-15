import type { ApiEnvelope } from '@/types/api';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }

    interface Response {
      locals: {
        payload?: ApiEnvelope<unknown>;
      };
    }
  }
}

export {};
