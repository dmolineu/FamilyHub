import { describe, expect, it } from "vitest";
import { fromWire, toWire } from "./calendar-wire";
import { formatLocalDate } from "./time-utils";
import type { CalendarEvent, CalendarEventResponse } from "./types";

// Phase 4: the API speaks Google's terms (ISO instants, exclusive all-day ends, member
// lists, original starts); the views keep the family's local terms. These two functions
// are the only place the two meet, always in the family's zone.

const LA = "America/Los_Angeles";

function wire(
  overrides: Partial<CalendarEventResponse> = {},
): CalendarEventResponse {
  return {
    id: "row-1",
    occurrenceId: "row-1",
    calendarId: "cal-1",
    calendarColor: "#9fc6e7",
    googleEventId: "g1",
    etag: '"3"',
    recurringEventId: null,
    originalStart: null,
    recurring: false,
    recurrence: null,
    title: "Swim",
    description: null,
    location: "Pool",
    htmlLink: "https://calendar.google.com/event?eid=g1",
    allDay: false,
    start: "2026-12-03T17:00:00Z",
    end: "2026-12-03T18:00:00Z",
    timeZone: LA,
    memberIds: ["maya", "dad"],
    status: "confirmed",
    canEdit: true,
    ...overrides,
  };
}

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "row-1",
    title: "Swim",
    startTime: "9:00 AM",
    endTime: "10:00 AM",
    date: new Date(2026, 11, 3),
    memberId: "maya",
    memberIds: ["maya"],
    isAllDay: false,
    ...overrides,
  };
}

describe("fromWire", () => {
  it("shows a timed event at its local time in the family's zone", () => {
    const shown = fromWire(wire(), LA);

    expect(formatLocalDate(shown.date)).toBe("2026-12-03");
    expect(shown.startTime).toBe("9:00 AM");
    expect(shown.endTime).toBe("10:00 AM");
    expect(shown.endDate).toBeUndefined();
    expect(shown.memberId).toBe("maya");
    expect(shown.memberIds).toEqual(["maya", "dad"]);
    expect(shown.isAllDay).toBe(false);
    expect(shown.location).toBe("Pool");
    expect(shown.source).toBe("GOOGLE");
    expect(shown.canEdit).toBe(true);
    expect(shown.etag).toBe('"3"');
    expect(shown.calendarColor).toBe("#9fc6e7");
    expect(shown.occurrenceId).toBe("row-1");
  });

  it("puts an evening event on the family's day, not UTC's", () => {
    const shown = fromWire(
      wire({ start: "2026-12-04T05:00:00Z", end: "2026-12-04T06:30:00Z" }),
      LA,
    );

    expect(formatLocalDate(shown.date)).toBe("2026-12-03");
    expect(shown.startTime).toBe("9:00 PM");
    expect(shown.endTime).toBe("10:30 PM");
  });

  it("turns Google's exclusive all-day end into the last day", () => {
    const trip = fromWire(
      wire({ allDay: true, start: "2026-12-10", end: "2026-12-13" }),
      LA,
    );
    expect(formatLocalDate(trip.date)).toBe("2026-12-10");
    expect(trip.endDate && formatLocalDate(trip.endDate)).toBe("2026-12-12");
    expect(trip.isAllDay).toBe(true);

    const oneDay = fromWire(
      wire({ allDay: true, start: "2026-12-10", end: "2026-12-11" }),
      LA,
    );
    expect(oneDay.endDate).toBeUndefined();
  });

  it("names a plain occurrence by its series, as an expanded instance with no id", () => {
    const shown = fromWire(
      wire({
        id: "master",
        occurrenceId: "master:20261204T000000Z",
        recurringEventId: "master",
        originalStart: "20261204T000000Z",
        recurring: true,
        recurrence: ["RRULE:FREQ=WEEKLY;COUNT=2", "EXDATE:20261211T000000Z"],
      }),
      LA,
    );

    expect(shown.id).toBeNull();
    expect(shown.recurringEventId).toBe("master");
    expect(shown.isRecurring).toBe(true);
    expect(shown.recurrenceRule).toBe("FREQ=WEEKLY;COUNT=2");
    expect(shown.originalStart).toBe("20261204T000000Z");
    expect(shown.recurrence).toEqual([
      "RRULE:FREQ=WEEKLY;COUNT=2",
      "EXDATE:20261211T000000Z",
    ]);
  });

  it("reads a series' UTC 'until' as the family's day, not this device's", () => {
    // The end of Dec 8 in Honolulu is 09:59:59 UTC on Dec 9: on a device in UTC or
    // Pacific time that instant is already Dec 9, but the family's last day is Dec 8.
    const shown = fromWire(
      wire({
        timeZone: "Pacific/Honolulu",
        recurring: true,
        recurrence: [
          "RRULE:FREQ=DAILY;UNTIL=20261209T095959Z",
          "EXDATE;TZID=Pacific/Honolulu:20261205T070000",
        ],
      }),
      "Pacific/Honolulu",
    );

    expect(shown.recurrenceRule).toBe("FREQ=DAILY;UNTIL=20261208");
    // The series' own lines go back to Google as they came.
    expect(shown.recurrence?.[0]).toBe(
      "RRULE:FREQ=DAILY;UNTIL=20261209T095959Z",
    );
  });

  it("keeps the id of a date changed on its own", () => {
    const shown = fromWire(
      wire({
        id: "instance",
        recurringEventId: "master",
        originalStart: "20261204T000000Z",
        recurring: true,
      }),
      LA,
    );

    expect(shown.id).toBe("instance");
    expect(shown.recurringEventId).toBe("master");
  });
});

describe("toWire", () => {
  it("sends a timed event as instants in the family's zone", () => {
    const body = toWire(
      {
        title: "Swim",
        date: "2026-12-03",
        startTime: "9:00 AM",
        endTime: "10:00 AM",
        memberId: "maya",
        isAllDay: false,
        location: "Pool",
      },
      LA,
    );

    expect(body.allDay).toBe(false);
    expect(body.start).toBe("2026-12-03T17:00:00.000Z");
    expect(body.end).toBe("2026-12-03T18:00:00.000Z");
    expect(body.timeZone).toBe(LA);
    expect(body.memberIds).toEqual(["maya"]);
    expect(body.location).toBe("Pool");
    expect(body.recurrence).toBeNull();
  });

  it("follows daylight saving time and runs past midnight into the next day", () => {
    const spring = toWire(
      {
        title: "Class",
        date: "2026-03-08",
        startTime: "9:00 AM",
        endTime: "10:00 AM",
        memberId: "maya",
      },
      LA,
    );
    expect(spring.start).toBe("2026-03-08T16:00:00.000Z");

    const late = toWire(
      {
        title: "Late",
        date: "2026-12-03",
        startTime: "11:00 PM",
        endTime: "1:00 AM",
        memberId: "maya",
      },
      LA,
    );
    expect(late.start).toBe("2026-12-04T07:00:00.000Z");
    expect(late.end).toBe("2026-12-04T09:00:00.000Z");
  });

  it("sends an all-day event with Google's exclusive end", () => {
    const trip = toWire(
      {
        title: "Trip",
        date: "2026-12-10",
        endDate: "2026-12-12",
        startTime: "12:00 AM",
        endTime: "12:00 AM",
        memberId: "dad",
        isAllDay: true,
      },
      LA,
    );
    expect(trip.allDay).toBe(true);
    expect(trip.startDate).toBe("2026-12-10");
    expect(trip.endDate).toBe("2026-12-13");
    expect(trip.start).toBeNull();

    const oneDay = toWire(
      {
        title: "Fair",
        date: "2026-12-10",
        startTime: "12:00 AM",
        endTime: "12:00 AM",
        memberId: "dad",
        isAllDay: true,
      },
      LA,
    );
    expect(oneDay.endDate).toBe("2026-12-11");
  });

  it("keeps an event's other members when its lead member stays among them", () => {
    const shared = event({ memberId: "maya", memberIds: ["maya", "dad"] });
    const same = {
      title: "Swim",
      date: "2026-12-03",
      startTime: "9:00 AM",
      endTime: "10:00 AM",
    };

    expect(toWire({ ...same, memberId: "dad" }, LA, shared).memberIds).toEqual([
      "maya",
      "dad",
    ]);
    expect(toWire({ ...same, memberId: "zev" }, LA, shared).memberIds).toEqual([
      "zev",
    ]);
  });

  it("sends a new rule, keeps a series' other lines, and leaves them alone when not asked", () => {
    const base = {
      title: "Class",
      date: "2026-12-04",
      startTime: "4:00 PM",
      endTime: "5:00 PM",
      memberId: "maya",
    };
    const series = event({
      recurrenceRule: "FREQ=WEEKLY",
      recurrence: [
        "RRULE:FREQ=WEEKLY",
        "EXDATE;TZID=America/Los_Angeles:20261211T160000",
      ],
    });

    expect(
      toWire({ ...base, recurrenceRule: "FREQ=DAILY" }, LA).recurrence,
    ).toEqual(["RRULE:FREQ=DAILY"]);
    expect(toWire(base, LA, series).recurrence).toBeNull();
    expect(
      toWire({ ...base, recurrenceRule: "FREQ=WEEKLY;COUNT=4" }, LA, series)
        .recurrence,
    ).toEqual([
      "RRULE:FREQ=WEEKLY;COUNT=4",
      "EXDATE;TZID=America/Los_Angeles:20261211T160000",
    ]);
    expect(
      toWire({ ...base, recurrenceRule: null }, LA, series).recurrence,
    ).toEqual([]);
  });

  it("sends the etag the event was read with", () => {
    const body = toWire(
      {
        title: "Swim",
        date: "2026-12-03",
        startTime: "9:00 AM",
        endTime: "10:00 AM",
        memberId: "maya",
      },
      LA,
      event({ etag: '"7"' }),
    );
    expect(body.etag).toBe('"7"');
  });
});
