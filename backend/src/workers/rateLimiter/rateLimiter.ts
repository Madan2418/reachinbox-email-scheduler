import { Redis } from 'ioredis';
import { hourKey, currentHourWindowEnd } from '../../lib/time.js';
import { env } from '../../config/env.js';

const LUA_SCRIPT = `
local limit     = tonumber(ARGV[1])
local minDelay  = tonumber(ARGV[2])
local nowMs     = tonumber(ARGV[3])
local windowEnd = tonumber(ARGV[4])

-- Check and increment hourly counter
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], 7200)
end

if count > limit then
  -- Undo the increment and return limit hit
  redis.call('DECR', KEYS[1])
  local waitMs = windowEnd - nowMs
  return {'HOURLY_LIMIT', tostring(waitMs)}
end

-- Check minimum delay between sends
local nextSlot = tonumber(redis.call('GET', KEYS[2])) or 0
local startMs  = math.max(nextSlot, nowMs)

if startMs > nowMs then
  -- Can't send yet, undo increment
  redis.call('DECR', KEYS[1])
  return {'TOO_SOON', tostring(startMs - nowMs)}
end

-- Reserve the slot
redis.call('SET', KEYS[2], tostring(startMs + minDelay), 'PX', 7200000)

return {'OK', '0'}
`;

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
