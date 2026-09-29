import type { Request, Response, NextFunction } from 'express';
import { getGoogleAuthUrl, verifyGoogleCode } from '../../integrations/google.js';
import { createSessionToken } from '../../middleware/auth.js';
import { upsertUser, seedSendersForUser } from './auth.service.js';
import { env } from '../../config/env.js';
import { randomBytes } from 'crypto';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('auth.controller');

export function startGoogleAuth(req: Request, res: Response): void {
  let origin = env.FRONTEND_URL;
  const referer = req.headers['referer'] || req.headers['origin'];
  if (typeof referer === 'string' && referer.startsWith('http')) {
    try {
      origin = new URL(referer).origin;
    } catch {
      // use default
    }
  }

  const state = Buffer.from(
    JSON.stringify({
      nonce: randomBytes(8).toString('hex'),
      origin,
    }),
  ).toString('base64url');

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

    let frontendOrigin = env.FRONTEND_URL;
    const stateParam = req.query['state'] as string | undefined;
    if (stateParam) {
      try {
        const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString('utf-8')) as {
          origin?: string;
        };
        if (typeof decoded.origin === 'string' && decoded.origin.startsWith('http')) {
          frontendOrigin = decoded.origin;
        }
      } catch {
        // fallback to env.FRONTEND_URL
      }
    }

    const targetUrl = `${frontendOrigin.replace(/\/+$/, '')}/?token=${encodeURIComponent(token)}`;
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
