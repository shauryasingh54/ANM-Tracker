/**
 * Date and Time utilities for India Standard Time (IST, UTC+05:30)
 * Handles midnight roll-over and location staleness checks.
 */

/**
 * Returns today's date in IST formatted as YYYY-MM-DD.
 */
export function getTodayISTDate(): string {
  // Use Intl.DateTimeFormat with Asia/Kolkata timezone to get accurate IST date
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date()); // Outputs YYYY-MM-DD
}

/**
 * Formats an ISO timestamp or date string into readable IST time (e.g., "11:42 AM")
 */
export function formatISTTime(dateString: string | Date): string {
  if (!dateString) return 'N/A';
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return 'Invalid date';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Formats a timestamp into relative time like "Just now", "25s ago", "3m ago"
 */
export function formatRelativeTime(dateString: string | Date): string {
  if (!dateString) return 'Never';
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();

  if (diffMs < 0) return 'Just now';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 15) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  return `${Math.floor(diffHour / 24)}d ago`;
}

/**
 * Checks whether a location timestamp is stale (older than 2 minutes = 120,000 ms)
 */
export function isLocationStale(lastUpdated: string | Date | null | undefined): boolean {
  if (!lastUpdated) return true;
  const d = typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated;
  const diffMs = Date.now() - d.getTime();
  return diffMs > 120 * 1000; // 2 minutes threshold
}

/**
 * Returns milliseconds remaining until next midnight in IST (for automatic daily reset)
 */
export function getMsUntilISTMidnight(): number {
  const now = new Date();
  // Get current IST hour/min/sec
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const parts = istFormatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);

  const secondsSinceMidnight = hour * 3600 + minute * 60 + second;
  const totalSecondsInDay = 86400;
  const secondsRemaining = totalSecondsInDay - secondsSinceMidnight;

  return Math.max(1000, secondsRemaining * 1000);
}
