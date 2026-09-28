import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError } from '../lib/errors.js';

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: SessionPayload;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.['token'] as string | undefined;
  if (!token) {
    next(new UnauthorizedError('No session token'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as SessionPayload;
    req.session = payload;
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired session'));
  }
}

export function createSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}
