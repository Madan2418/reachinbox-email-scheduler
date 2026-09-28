import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Redis } from 'ioredis';
import { hourKey, currentHourWindowEnd } from '../../lib/time.js';
import { env } from '../../config/env.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const LUA_SCRIPT = readFileSync(join(__dirname, 'reserve.lua'), 'utf-8');

export type ReserveResult =
  | { status: 'OK'; waitMs: 0 }
  | { status: 'HOURLY_LIMIT'; waitMs: number }
  | { status: 'TOO_SOON'; waitMs: number };

/**
 * Computes the effective hourly limit for a sender.
 * The env MAX_EMAILS_PER_HOUR_PER_SENDER is the absolute ceiling.
 */
export function effectiveLimit(
  campaignHourlyLimit: number,
  senderHourlyLimit: number | null | undefined,
): number {
  const limits = [env.MAX_EMAILS_PER_HOUR_PER_SENDER, campaignHourlyLimit];
  if (senderHourlyLimit != null) limits.push(senderHourlyLimit);
  return Math.min(...limits);
}

/**
 * Atomically reserves a send slot for the given sender using a Lua script.
 */
export async function reserveSlot(
  redis: Redis,
  senderId: string,
  limit: number,
): Promise<ReserveResult> {
  const nowMs = Date.now();
  const hw = hourKey(nowMs);
  const windowEndMs = currentHourWindowEnd(nowMs);

  const rateKey = `rate:${senderId}:${hw}`;
  const slotKey = `slot:${senderId}`;
  const notifiedKey = `slacknotified:${senderId}:${hw}`;

  const result = (await redis.eval(
    LUA_SCRIPT,
    3,
    rateKey,
    slotKey,
    notifiedKey,
    String(limit),
    String(env.MIN_DELAY_MS),
    String(nowMs),
    String(windowEndMs),
  )) as [string, string];

  const status = result[0] as ReserveResult['status'];
  const waitMs = parseInt(result[1] ?? '0', 10);

  return { status, waitMs } as ReserveResult;
}

/**
 * Sets the Slack notified NX flag. Returns true if this is the first notification this window.
 */
export async function setSlackNotified(
  redis: Redis,
  senderId: string,
): Promise<boolean> {
  const hw = hourKey();
  const key = `slacknotified:${senderId}:${hw}`;
  // Use SET with NX and EX options (ioredis supports positional args)
  const result = await redis.set(key, '1', 'EX', 7200, 'NX');
  return result === 'OK';
}
