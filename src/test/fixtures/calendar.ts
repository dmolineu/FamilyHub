import { calendarZone, fromWire, toWire } from "@/lib/calendar-wire";
import { formatLocalDate } from "@/lib/time-utils";
import type {
  CalendarEvent,
  CalendarEventResponse,
  CalendarWriteBody,
  CreateEventRequest,
  UpdateEventRequest,
} from "@/lib/types";
import { testMembers } from "./family";

/**
 * Today's date at midnight (for consistent test dates).
 */
export const today = new Date();
today.setHours(0, 0, 0, 0);

/**
 * Create a date relative to today.
 */
export function getRelativeDate(daysFromToday: number): Date {
  const date = new Date(today);
  date.setDate(date.getDate() + daysFromToday);
  return date;
}

/**
 * Test events for various scenarios.
 */
export const testEvents: CalendarEvent[] = [
  {
    id: "event-1",
    title: "Morning Meeting",
    startTime: "9:00 AM",
    endTime: "10:00 AM",
    date: today,
    memberId: testMembers[0].id,
    isAllDay: false,
  },
  {
    id: "event-2",
    title: "Lunch with Team",
    startTime: "12:00 PM",
    endTime: "1:00 PM",
    date: today,
    memberId: testMembers[1].id,
    isAllDay: false,
    location: "Downtown Cafe",
  },
  {
    id: "event-3",
    title: "Soccer Practice",
    startTime: "4:00 PM",
    endTime: "5:30 PM",
    date: today,
    memberId: testMembers[2].id,
    isAllDay: false,
  },
  {
    id: "event-4",
    title: "All Day Event",
    startTime: "12:00 AM",
    endTime: "11:59 PM",
    date: today,
    memberId: testMembers[0].id,
    isAllDay: true,
  },
];

/**
 * Single test event for simpler tests.
 */
export const testEvent: CalendarEvent = testEvents[0];

/**
 * Test event for tomorrow.
 */
export const tomorrowEvent: CalendarEvent = {
  id: "event-tomorrow",
  title: "Tomorrow's Meeting",
  startTime: "10:00 AM",
  endTime: "11:00 AM",
  date: getRelativeDate(1),
  memberId: testMembers[0].id,
  isAllDay: false,
};

/**
 * Test event for yesterday.
 */
export const yesterdayEvent: CalendarEvent = {
  id: "event-yesterday",
  title: "Yesterday's Event",
  startTime: "2:00 PM",
  endTime: "3:00 PM",
  date: getRelativeDate(-1),
  memberId: testMembers[1].id,
  isAllDay: false,
};

/**
 * Create a custom test event with overrides.
 */
export function createTestEvent(
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id: `event-${Date.now()}`,
    title: "Test Event",
    startTime: "9:00 AM",
    endTime: "10:00 AM",
    date: today,
    memberId: testMembers[0].id,
    isAllDay: false,
    ...overrides,
  };
}

/**
 * Create a valid CreateEventRequest for API testing.
 */
export function createEventRequest(
  overrides: Partial<CreateEventRequest> = {},
): CreateEventRequest {
  const date = overrides.date ?? formatLocalDate(today);
  return {
    title: "New Event",
    startTime: "2:00 PM",
    endTime: "3:00 PM",
    date,
    memberId: testMembers[0].id,
    ...overrides,
  };
}

/**
 * Create a valid update mutation variables object for API testing.
 * Builds from an existing CalendarEvent, converting the date to a string.
 * Returns `{ id } & UpdateEventRequest` matching the mutation variables shape.
 */
export function createUpdateRequest(
  event: CalendarEvent,
  overrides: Partial<UpdateEventRequest> = {},
): { id: string } & UpdateEventRequest {
  return {
    id: event.id,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    date: formatLocalDate(event.date),
    memberId: event.memberId,
    isAllDay: event.isAllDay,
    location: event.location,
    ...overrides,
  };
}

/**
 * Events for a full week of testing.
 */
export function createWeekOfEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let i = 0; i < 7; i++) {
    events.push({
      id: `week-event-${i}`,
      title: `Day ${i} Event`,
      startTime: "10:00 AM",
      endTime: "11:00 AM",
      date: getRelativeDate(i),
      memberId: testMembers[i % testMembers.length].id,
      isAllDay: false,
    });
  }
  return events;
}

// ============================================================================
// Mock-API fixtures: events as the mock API stores them (the family's terms, with
// "yyyy-MM-dd" dates). The mock API turns them into the real API's Phase 4 wire format
// (`toApiEvent`) and turns what the app sends back into them (`fromWriteBody`), with the
// app's own conversions, so seeds stay simple and every request makes the real round trip.
// ============================================================================

/** An event as the mock API stores it. */
export type CalendarEventFixture = Omit<CalendarEvent, "date" | "endDate"> & {
  date: string;
  endDate?: string;
};

/**
 * Convert a CalendarEvent to a CalendarEventFixture (string date).
 */
export function toEventResponse(event: CalendarEvent): CalendarEventFixture {
  return {
    ...event,
    date: formatLocalDate(event.date),
    endDate: event.endDate ? formatLocalDate(event.endDate) : undefined,
  };
}

const COMPACT = (start: string) =>
  start.replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/**
 * A stored mock event as the real API sends it (Phase 4), in this device's zone, which
 * is the app's too when the family has none (the fixtures give it none). A stored event
 * with no id but a series is a plain date of that series; one with an id is an event of
 * its own (a whole series when it repeats).
 */
export function toApiEvent(
  fixture: CalendarEventFixture,
  zone: string = calendarZone(),
): CalendarEventResponse {
  const body = toWire(
    {
      title: fixture.title,
      date: fixture.date,
      endDate: fixture.endDate,
      startTime: fixture.startTime,
      endTime: fixture.endTime,
      memberId: fixture.memberId,
      memberIds: fixture.memberIds,
      isAllDay: fixture.isAllDay,
      location: fixture.location,
      description: fixture.description,
      recurrenceRule: fixture.recurrenceRule,
    },
    zone,
  );
  const start = body.allDay
    ? (body.startDate as string)
    : (body.start as string);
  const end = body.allDay ? (body.endDate as string) : (body.end as string);
  const seriesId = fixture.recurringEventId ?? null;
  const id = fixture.id ?? seriesId ?? `event-${fixture.title}`;
  const originalStart =
    fixture.originalStart ?? (seriesId ? COMPACT(start) : null);
  return {
    id,
    occurrenceId:
      fixture.occurrenceId ??
      (fixture.id ? fixture.id : `${seriesId}:${originalStart}`),
    calendarId: fixture.calendarId ?? "cal-family",
    calendarColor: fixture.calendarColor ?? null,
    googleEventId: fixture.googleEventId ?? id,
    etag: fixture.etag ?? '"1"',
    recurringEventId: seriesId,
    originalStart,
    recurring: fixture.isRecurring ?? Boolean(seriesId),
    recurrence:
      fixture.recurrence ??
      (fixture.recurrenceRule ? [`RRULE:${fixture.recurrenceRule}`] : null),
    title: fixture.title,
    description: fixture.description ?? null,
    location: fixture.location ?? null,
    htmlLink: fixture.htmlLink ?? null,
    allDay: body.allDay,
    start,
    end,
    timeZone: zone,
    memberIds: body.memberIds,
    status: "confirmed",
    // Read-only Google events of the old fixtures stay read-only.
    canEdit: fixture.canEdit ?? fixture.source !== "GOOGLE",
  };
}

/**
 * What the app sent (Phase 4 wire) as a stored mock event, through the app's own
 * conversion. `recurrence: null` (keep) leaves the rule to the caller.
 */
export function fromWriteBody(
  body: CalendarWriteBody,
  id: string,
  zone: string = calendarZone(),
): CalendarEventFixture {
  const shown = fromWire(
    {
      id,
      occurrenceId: id,
      calendarId: body.calendarId,
      calendarColor: null,
      googleEventId: id,
      etag: '"2"',
      recurringEventId: null,
      originalStart: null,
      recurring: Boolean(body.recurrence && body.recurrence.length > 0),
      recurrence:
        body.recurrence && body.recurrence.length > 0 ? body.recurrence : null,
      title: body.title,
      description: body.description,
      location: body.location,
      htmlLink: null,
      allDay: body.allDay,
      start: body.allDay ? (body.startDate as string) : (body.start as string),
      end: body.allDay ? (body.endDate as string) : (body.end as string),
      timeZone: zone,
      memberIds: body.memberIds,
      status: "confirmed",
      canEdit: true,
    },
    zone,
  );
  return {
    ...shown,
    id,
    source: undefined,
    date: formatLocalDate(shown.date),
    endDate: shown.endDate ? formatLocalDate(shown.endDate) : undefined,
  };
}

/**
 * Create a CalendarEventFixture with string date for MSW handler seeding.
 */
export function createTestEventResponse(
  overrides: Partial<CalendarEventFixture> = {},
): CalendarEventFixture {
  return {
    id: `event-${Date.now()}`,
    title: "Test Event",
    startTime: "9:00 AM",
    endTime: "10:00 AM",
    date: formatLocalDate(today),
    memberId: testMembers[0].id,
    isAllDay: false,
    ...overrides,
  };
}

/**
 * Wire-format versions of testEvents for seeding MSW handlers.
 */
export const testEventResponses: CalendarEventFixture[] =
  testEvents.map(toEventResponse);
