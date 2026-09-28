-- reserve.lua
-- Atomically reserves a send slot for a sender.
-- KEYS[1]: rate key     (rate:{senderId}:{YYYYMMDDHH})
-- KEYS[2]: slot key     (slot:{senderId})
-- KEYS[3]: notified key (slacknotified:{senderId}:{YYYYMMDDHH})
-- ARGV[1]: limit        (effective hourly limit)
-- ARGV[2]: minDelayMs   (minimum ms between sends)
-- ARGV[3]: nowMs        (current time in ms)
-- ARGV[4]: windowEndMs  (end of current UTC hour in ms)
--
-- Returns: {status, waitMs}
--   status: "OK" | "HOURLY_LIMIT" | "TOO_SOON"
--   waitMs: ms to wait before next attempt (0 if OK)

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
