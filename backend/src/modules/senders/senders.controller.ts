import type { Request, Response, NextFunction } from 'express';
import { db } from '../../db/client.js';
import { senders } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { redis } from '../../lib/redis.js';
import { hourKey, currentHourWindowEnd } from '../../lib/time.js';
import { env } from '../../config/env.js';

export async function getSenders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.session!.userId;
    const rows = await db
      .select({
        id: senders.id,
        label: senders.label,
        fromEmail: senders.fromEmail,
        hourlyLimit: senders.hourlyLimit,
      })
      .from(senders)
      .where(eq(senders.userId, userId));

    res.json({ senders: rows });
  } catch (err) {
    next(err);
  }
}

export async function getLimits(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.session!.userId;
    const userSenders = await db
      .select()
      .from(senders)
      .where(eq(senders.userId, userId));

    const nowMs = Date.now();
    const hw = hourKey(nowMs);
    const resetsAt = currentHourWindowEnd(nowMs);

    const limits = await Promise.all(
      userSenders.map(async (sender) => {
        const rateKey = `rate:${sender.id}:${hw}`;
        const usedStr = await redis.get(rateKey);
        const used = usedStr ? parseInt(usedStr, 10) : 0;
        const limit = Math.min(
          env.MAX_EMAILS_PER_HOUR_PER_SENDER,
          sender.hourlyLimit ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER,
        );

        return {
          senderId: sender.id,
          label: sender.label,
          fromEmail: sender.fromEmail,
          used,
          limit,
          resetsAt: new Date(resetsAt).toISOString(),
        };
      }),
    );

    res.json({ limits });
  } catch (err) {
    next(err);
  }
}
