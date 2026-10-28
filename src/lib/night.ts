const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutes(value: string): number | null {
  const match = TIME.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/**
 * Whether `now` falls in the night window ["from", "until") in the family's zone, both
 * "HH:mm". A window whose start is after its end runs past midnight (22:00–06:30). An
 * empty or unreadable window is never night, so a bad setting cannot blank the wall.
 */
export function isNightTime(
  now: Date,
  timeZone: string | undefined,
  from: string,
  until: string,
): boolean {
  const start = minutes(from);
  const end = minutes(until);
  if (start === null || end === null || start === end) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const current = hour * 60 + minute;
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}
