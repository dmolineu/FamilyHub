/**
 * Times in the chores screens. The API writes completion times as UTC without a
 * zone suffix (Java LocalDateTime on a UTC clock) and log times as instants, so
 * both are read as UTC and shown in the family's time zone: a wall in California
 * and a phone travelling abroad must agree on when Maya fed the cat.
 */

const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/** Parses an API timestamp; one without a zone is UTC. */
export function parseServerInstant(value: string): Date {
  return new Date(HAS_ZONE.test(value) ? value : `${value}Z`);
}

/** Formats a timestamp, or gives "" for one that cannot be read. */
function formatOrBlank(
  value: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = parseServerInstant(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, options).format(date);
}

function zoneOrDevice(timeZone: string | undefined): string {
  return timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** "4:10 PM" in the family's zone. */
export function formatTimeInZone(
  value: string,
  timeZone: string | undefined,
): string {
  return formatOrBlank(value, "en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: zoneOrDevice(timeZone),
  });
}

/** "Sunday, October 25" in the family's zone. */
export function formatDayInZone(
  value: string,
  timeZone: string | undefined,
): string {
  return formatOrBlank(value, "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: zoneOrDevice(timeZone),
  });
}

/** "2026-10-25" in the family's zone, for grouping by day. */
export function dayKeyInZone(
  value: string,
  timeZone: string | undefined,
): string {
  // en-CA formats dates as yyyy-mm-dd.
  return formatOrBlank(value, "en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: zoneOrDevice(timeZone),
  });
}

/** "Sat, Oct 24, 9:05 AM" in the family's zone: when a chore was ticked. */
export function formatDateTimeInZone(
  value: string,
  timeZone: string | undefined,
): string {
  return formatOrBlank(value, "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: zoneOrDevice(timeZone),
  });
}
