import { addDays } from "date-fns";
import { formatLocalDate, parseLocalDate, parseTime } from "./time-utils";
import type {
  CalendarEvent,
  CalendarEventResponse,
  CalendarWriteBody,
  CreateEventRequest,
} from "./types";

/**
 * Phase 4: the API speaks Google's terms, the views the family's. These are the only
 * two places they meet, always in the family's time zone:
 * - `fromWire`: ISO instants become a local day and "9:00 AM" times; Google's exclusive
 *   all-day end becomes the last day; a plain date of a series has no id of its own (as
 *   the old expanded instances), and is named by its series and `originalStart`.
 * - `toWire`: the reverse, plus what a change keeps (an event's other members, a series'
 *   excluded dates, the etag it was read with).
 */

const ALL_DAY_TIME = "12:00 AM";

/** The zone the family's calendar is shown in: the family's, else this device's. */
export function calendarZone(familyZone?: string | null): string {
  return familyZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

interface ZonedParts {
  iso: string;
  time: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function zoned(instant: Date, zone: string): ZonedParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return {
    iso: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${twelve}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`,
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute,
  };
}

// The instant a wall-clock time in a zone falls on, DST included.
function instantOf(dateIso: string, time12: string, zone: string): Date {
  const [year, month, day] = dateIso.split("-").map(Number);
  const { hours, minutes } = parseTime(time12);
  const wall = Date.UTC(year, month - 1, day, hours, minutes);
  let instant = wall;
  for (let i = 0; i < 2; i++) {
    const seen = zoned(new Date(instant), zone);
    const seenAsUtc = Date.UTC(
      seen.year,
      seen.month - 1,
      seen.day,
      seen.hour,
      seen.minute,
    );
    instant += wall - seenAsUtc;
  }
  return new Date(instant);
}

// A timed series' "until" comes as a UTC instant (the end of the last day in the family's
// zone). The views read UNTIL as a day, so it becomes the family's day here, where the
// zone is known; read on a device in another zone the instant can fall on the next day.
function rruleOf(lines: string[] | null, zone: string): string | undefined {
  const rule = lines?.find((line) => line.toUpperCase().startsWith("RRULE:"));
  if (!rule) return undefined;
  return rule
    .slice("RRULE:".length)
    .replace(
      /UNTIL=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/i,
      (_match, y, mo, d, h, mi, se) => {
        const instant = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +se));
        return `UNTIL=${zoned(instant, zone).iso.replaceAll("-", "")}`;
      },
    );
}

/** An API event as the views show it, in the family's zone. */
export function fromWire(
  raw: CalendarEventResponse,
  zone: string,
): CalendarEvent {
  let date: Date;
  let endDate: Date | undefined;
  let startTime = ALL_DAY_TIME;
  let endTime = ALL_DAY_TIME;
  if (raw.allDay) {
    date = parseLocalDate(raw.start);
    const last = addDays(parseLocalDate(raw.end), -1);
    endDate = last > date ? last : undefined;
  } else {
    const start = zoned(new Date(raw.start), zone);
    const end = zoned(new Date(raw.end), zone);
    date = parseLocalDate(start.iso);
    startTime = start.time;
    endTime = end.time;
  }
  // A plain date of a series comes with its series' id: like the old expanded instances, it has none of its own.
  const plainOccurrence = raw.recurring && raw.recurringEventId === raw.id;
  return {
    id: plainOccurrence ? null : raw.id,
    title: raw.title,
    startTime,
    endTime,
    date,
    endDate,
    memberId: raw.memberIds[0] ?? "",
    memberIds: raw.memberIds,
    isAllDay: raw.allDay,
    location: raw.location ?? undefined,
    description: raw.description ?? undefined,
    htmlLink: raw.htmlLink ?? undefined,
    recurrenceRule: rruleOf(raw.recurrence, zone),
    recurringEventId: raw.recurringEventId ?? undefined,
    isRecurring: raw.recurring,
    source: "GOOGLE",
    occurrenceId: raw.occurrenceId,
    originalStart: raw.originalStart ?? undefined,
    etag: raw.etag ?? undefined,
    calendarId: raw.calendarId ?? undefined,
    calendarColor: raw.calendarColor ?? undefined,
    canEdit: raw.canEdit,
    recurrence: raw.recurrence ?? undefined,
    timeZone: raw.timeZone,
    googleEventId: raw.googleEventId,
  };
}

/** What the form edits, in the family's terms; the request types fit it. */
export type CalendarWriteInput = Pick<
  CreateEventRequest,
  "title" | "startTime" | "endTime" | "date"
> &
  Partial<
    Pick<
      CreateEventRequest,
      | "endDate"
      | "memberId"
      | "memberIds"
      | "isAllDay"
      | "location"
      | "recurrenceRule"
      | "description"
      | "etag"
      | "calendarId"
    >
  >;

function memberIdsFor(
  input: CalendarWriteInput,
  existing?: CalendarEvent,
): string[] {
  if (input.memberIds && input.memberIds.length > 0) return input.memberIds;
  const lead = input.memberId ?? existing?.memberId ?? "";
  // The form edits one member; an event shared by several keeps them while its lead stays among them.
  if (
    existing?.memberIds &&
    existing.memberIds.length > 1 &&
    existing.memberIds.includes(lead)
  ) {
    return existing.memberIds;
  }
  return lead ? [lead] : [];
}

function recurrenceFor(
  input: CalendarWriteInput,
  existing?: CalendarEvent,
): string[] | null {
  if (input.recurrenceRule === undefined) return null;
  if (input.recurrenceRule === null || input.recurrenceRule === "") {
    return existing?.recurrence || existing?.recurrenceRule ? [] : null;
  }
  const rule = `RRULE:${input.recurrenceRule}`;
  const others = (existing?.recurrence ?? []).filter(
    (line) => !line.toUpperCase().startsWith("RRULE:"),
  );
  return [rule, ...others];
}

/** A create or change for the API, in Google's terms. */
export function toWire(
  input: CalendarWriteInput,
  zone: string,
  existing?: CalendarEvent,
): CalendarWriteBody {
  const allDay = input.isAllDay ?? false;
  let start: string | null = null;
  let end: string | null = null;
  let startDate: string | null = null;
  let endDate: string | null = null;
  if (allDay) {
    startDate = input.date;
    endDate = formatLocalDate(
      addDays(parseLocalDate(input.endDate ?? input.date), 1),
    );
  } else {
    const startAt = instantOf(input.date, input.startTime, zone);
    let endAt = instantOf(input.date, input.endTime, zone);
    if (endAt <= startAt && input.endTime !== input.startTime) {
      // 11:00 PM to 1:00 AM ends the next day.
      endAt = instantOf(
        formatLocalDate(addDays(parseLocalDate(input.date), 1)),
        input.endTime,
        zone,
      );
    }
    start = startAt.toISOString();
    end = endAt.toISOString();
  }
  return {
    calendarId: input.calendarId ?? null,
    memberIds: memberIdsFor(input, existing),
    title: input.title,
    description: input.description ?? null,
    location: input.location ?? null,
    allDay,
    start,
    end,
    startDate,
    endDate,
    timeZone: allDay ? null : zone,
    recurrence: recurrenceFor(input, existing),
    etag: input.etag ?? existing?.etag ?? null,
  };
}
