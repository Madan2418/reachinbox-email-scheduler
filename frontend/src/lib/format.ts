/**
 * Format a date string or ISO timestamp to a readable datetime.
 * Uses tabular-nums-friendly format.
 */
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/**
 * Returns a human-readable relative time (e.g., "in 23 minutes").
 */
export function formatDistanceToNow(dateStr: string): string {
  const date = new Date(dateStr);
  const nowMs = Date.now();
  const diffMs = date.getTime() - nowMs;

  if (diffMs <= 0) return 'soon';

  const diffMins = Math.round(diffMs / 60_000);
  if (diffMins < 60) return `in ${diffMins} min`;

  const diffHours = Math.round(diffMs / 3_600_000);
  return `in ${diffHours} hr`;
}
