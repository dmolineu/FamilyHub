import { parseLocalDate } from "@/lib/time-utils";
import type { CalendarEvent, MemberBirthday } from "@/lib/types";

/** A calendar date with no time or zone attached. */
export interface LocalDay {
  year: number;
  month: number; // 1-12
  day: number;
}

export interface NextBirthday extends LocalDay {
  daysUntil: number;
  /** The age reached on that birthday, when the birth year is known. */
  turning: number | null;
}

interface MemberWithBirthday {
  id: string;
  name: string;
  birthday?: MemberBirthday | null;
}

const DAY_MS = 86_400_000;

/** Today's date in a time zone (the family's), whatever zone the device is in. */
export function todayInZone(now: Date, timeZone: string): LocalDay {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const value = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: value("year"), month: value("month"), day: value("day") };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** 29 February is celebrated on 28 February in common years. */
function occurrenceIn(birthday: MemberBirthday, year: number): LocalDay {
  if (birthday.month === 2 && birthday.day === 29 && !isLeapYear(year)) {
    return { year, month: 2, day: 28 };
  }
  return { year, month: birthday.month, day: birthday.day };
}

function dayNumber({ year, month, day }: LocalDay): number {
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function nextBirthday(
  birthday: MemberBirthday,
  today: LocalDay,
): NextBirthday {
  let occurrence = occurrenceIn(birthday, today.year);
  if (dayNumber(occurrence) < dayNumber(today)) {
    occurrence = occurrenceIn(birthday, today.year + 1);
  }
  return {
    ...occurrence,
    daysUntil: dayNumber(occurrence) - dayNumber(today),
    turning: birthday.year ? occurrence.year - birthday.year : null,
  };
}

export function countdownLabel(daysUntil: number): string {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil} days`;
}

export interface UpcomingBirthday<M extends MemberWithBirthday>
  extends NextBirthday {
  member: M;
}

/** Birthdays within `withinDays` of today (inclusive), soonest first. */
export function upcomingBirthdays<M extends MemberWithBirthday>(
  members: M[],
  today: LocalDay,
  withinDays: number,
): UpcomingBirthday<M>[] {
  return members
    .flatMap((member) =>
      member.birthday
        ? [{ member, ...nextBirthday(member.birthday, today) }]
        : [],
    )
    .filter((b) => b.daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Birthdays as read-only all-day calendar entries for `[startDate, endDate]`
 * ("yyyy-MM-dd", inclusive), shown in the member's own lane.
 */
export function birthdayEventsInRange(
  members: MemberWithBirthday[],
  startDate: string,
  endDate: string,
): CalendarEvent[] {
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  const events: CalendarEvent[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    for (const member of members) {
      if (!member.birthday) continue;
      const day = occurrenceIn(member.birthday, year);
      const iso = `${day.year}-${pad(day.month)}-${pad(day.day)}`;
      if (iso < startDate || iso > endDate) continue;
      const turning = member.birthday.year ? year - member.birthday.year : null;
      events.push({
        id: `birthday:${member.id}:${year}`,
        title:
          turning !== null && turning > 0
            ? `${member.name}'s birthday (turns ${turning})`
            : `${member.name}'s birthday`,
        startTime: "12:00 AM",
        endTime: "11:59 PM",
        date: parseLocalDate(iso),
        memberId: member.id,
        isAllDay: true,
        source: "BIRTHDAY",
      });
    }
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}
