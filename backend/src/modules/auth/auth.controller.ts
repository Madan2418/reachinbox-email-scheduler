import type { Request, Response, NextFunction } from 'express';
import { getGoogleAuthUrl, verifyGoogleCode } from '../../integrations/google.js';
import { createSessionToken } from '../../middleware/auth.js';
import { upsertUser, seedSendersForUser } from './auth.service.js';
import { env } from '../../config/env.js';
import { randomBytes } from 'crypto';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('auth.controller');

export function startGoogleAuth(_req: Request, res: Response): void {
  const state = randomBytes(16).toString('hex');
  const url = getGoogleAuthUrl(state);
  res.redirect(url);
}

export async function googleCallback(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const code = req.query['code'] as string | undefined;
    if (!code) {
      res.status(400).json({ error: { code: 'MISSING_CODE', message: 'Missing OAuth code' } });
      return;
    }

    const googleUser = await verifyGoogleCode(code);
    const user = await upsertUser(googleUser);
    await seedSendersForUser(user.id);

    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const isProd = env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const targetUrl = env.FRONTEND_URL && env.FRONTEND_URL.startsWith('http')
      ? `${env.FRONTEND_URL.replace(/\/+$/, '')}/`
      : '/';
    res.redirect(targetUrl);
  } catch (err) {
    log.error({ err }, 'Google OAuth callback failed');
    next(err);
  }
}

export function getMe(req: Request, res: Response): void {
  res.json({ user: req.session });
}

export function logout(_req: Request, res: Response): void {
  const isProd = env.NODE_ENV === 'production';
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
  res.json({ ok: true });
}
