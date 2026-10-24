/**
 * Date and time utilities for CipherShare.
 * Ensures consistent handling of UTC timestamps across timezones.
 */

/**
 * Parses an ISO date-time string from the backend, guaranteeing it is treated as UTC.
 * If the string lacks a timezone offset or trailing 'Z', 'Z' is appended.
 */
export function parseUtcDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Check if string already has UTC 'Z' or timezone offset (+HH:MM or -HH:MM)
  const hasTimezone =
    trimmed.endsWith("Z") ||
    trimmed.endsWith("z") ||
    /[+-]\d{2}:?\d{2}$/.test(trimmed);
  const normalized = hasTimezone ? trimmed : `${trimmed}Z`;

  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats a remaining validity window (TTL) until key expiration.
 * Compares against current UTC time.
 */
export function formatExpiry(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "Permanent";
  const expDate = parseUtcDate(expiresAt);
  if (!expDate) return "Unknown";

  const diffMs = expDate.getTime() - Date.now();
  if (diffMs <= 0) return "Expired";

  const totalSecs = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hours > 0) {
    return `${hours}h ${mins}m left`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s left`;
  }
  return `${secs}s left`;
}

/**
 * Returns whether an expiration timestamp is in the past.
 */
export function isDateExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expDate = parseUtcDate(expiresAt);
  if (!expDate) return false;
  return expDate.getTime() <= Date.now();
}

/**
 * Formats a UTC ISO string to the user's localized date and time.
 */
export function formatLocalDateTime(dateStr: string | null | undefined): string {
  const d = parseUtcDate(dateStr);
  return d ? d.toLocaleString() : "—";
}

/**
 * Formats a UTC ISO string to the user's localized time (HH:MM:SS AM/PM).
 */
export function formatLocalTime(dateStr: string | null | undefined): string {
  const d = parseUtcDate(dateStr);
  return d ? d.toLocaleTimeString() : "—";
}
