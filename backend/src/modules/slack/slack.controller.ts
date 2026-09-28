import type { Request, Response, NextFunction } from 'express';
import { db } from '../../db/client.js';
import { slackConnections } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { exchangeSlackCode } from '../../integrations/slack.js';
import { encrypt } from '../../lib/crypto.js';
import { env } from '../../config/env.js';
import jwt from 'jsonwebtoken';
import { createChildLogger } from '../../lib/logger.js';

const log = createChildLogger('slack.controller');

export function startSlackConnect(req: Request, res: Response): void {
  const userId = req.session!.userId;
  const state = jwt.sign({ userId, exp: Math.floor(Date.now() / 1000) + 600 }, env.JWT_SECRET);

  const params = new URLSearchParams({
    client_id: process.env['SLACK_CLIENT_ID'] ?? '',
    scope: 'incoming-webhook',
    redirect_uri: env.SLACK_REDIRECT_URI,
    state,
  });

  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
}

export async function slackCallback(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) {
      res.status(400).send('Missing code or state');
      return;
    }

    const payload = jwt.verify(state, env.JWT_SECRET) as { userId: string };
    const { webhookUrl, channel, teamName } = await exchangeSlackCode(
      code,
      env.SLACK_REDIRECT_URI,
    );

    await db
      .insert(slackConnections)
      .values({
        userId: payload.userId,
        teamName,
        channel,
        webhookUrlEnc: encrypt(webhookUrl),
      })
      .onConflictDoUpdate({
        target: slackConnections.userId,
        set: { teamName, channel, webhookUrlEnc: encrypt(webhookUrl) },
      });

    res.redirect(`${env.FRONTEND_URL}/?slack=connected`);
  } catch (err) {
    log.error({ err }, 'Slack OAuth callback failed');
    next(err);
  }
}

export async function getSlackStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.session!.userId;
    const [connection] = await db
      .select({ teamName: slackConnections.teamName, channel: slackConnections.channel })
      .from(slackConnections)
      .where(eq(slackConnections.userId, userId))
      .limit(1);

    res.json({ connected: !!connection, ...(connection ?? {}) });
  } catch (err) {
    next(err);
  }
}

export async function disconnectSlack(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.session!.userId;
    await db.delete(slackConnections).where(eq(slackConnections.userId, userId));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
