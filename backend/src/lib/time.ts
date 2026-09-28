/**
 * Returns the start of the current UTC hour in milliseconds.
 */
export function currentHourWindowStart(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  d.setUTCMinutes(0, 0, 0);
  return d.getTime();
}

/**
 * Returns the end of the current UTC hour in milliseconds (exclusive).
 */
export function currentHourWindowEnd(nowMs: number = Date.now()): number {
  return currentHourWindowStart(nowMs) + 3_600_000;
}

/**
 * Returns a YYYYMMDDHH string key for the given timestamp.
 */
export function hourKey(nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}`;
}

/**
 * Returns a random jitter in [0, maxMs).
 */
export function jitter(maxMs: number): number {
  return Math.floor(Math.random() * maxMs);
}
