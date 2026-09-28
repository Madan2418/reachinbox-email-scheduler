import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../lib/errors.js';

type Target = 'body' | 'query' | 'params';

/**
 * Returns an Express middleware that validates `req[target]` against the given Zod schema.
 * On success, replaces the request field with the parsed (coerced) value.
 */
export function validate<T>(schema: ZodSchema<T>, target: Target = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      next(new ValidationError('Validation failed', result.error.flatten().fieldErrors));
      return;
    }
    // Overwrite with coerced, typed data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[target] = result.data;
    next();
  };
}
