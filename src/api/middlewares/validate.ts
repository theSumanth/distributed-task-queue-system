import type { Request, Response, NextFunction } from 'express';
import { z, type ZodType } from 'zod';

import { BadRequestError } from '../errors/app-error.js';

type ValidationTarget = 'body' | 'params' | 'query';

export const validate =
  (schema: ZodType, target: ValidationTarget = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const treeError = z.treeifyError(result.error);

      throw new BadRequestError('Validation failed', treeError);
    }

    req[target] = result.data;
    next();
  };
