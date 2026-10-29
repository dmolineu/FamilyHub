import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/lib/types";
import { isReadOnlyEvent, readOnlyNotice } from "./calendar-sources";

const base: CalendarEvent = {
  id: "e1",
  title: "Event",
  startTime: "09:00",
  endTime: "10:00",
  date: new Date(2026, 0, 15),
  memberId: "m1",
  isAllDay: false,
};

describe("calendar sources", () => {
  it("only the family's own events are editable", () => {
    expect(isReadOnlyEvent(base)).toBe(false);
    expect(isReadOnlyEvent({ ...base, source: "NATIVE" })).toBe(false);
    expect(isReadOnlyEvent({ ...base, source: "GOOGLE" })).toBe(true);
    expect(isReadOnlyEvent({ ...base, source: "BIRTHDAY" })).toBe(true);
    expect(isReadOnlyEvent({ ...base, source: "SPORTS" })).toBe(true);
  });

  it("explains where a read-only entry is changed", () => {
    expect(readOnlyNotice(base, "edit")).toBeNull();
    expect(readOnlyNotice({ ...base, source: "GOOGLE" }, "edit")).toEqual({
      title: "Synced from Google Calendar",
      description: "Edit this event in Google Calendar.",
    });
    expect(readOnlyNotice({ ...base, source: "GOOGLE" }, "delete")).toEqual({
      title: "Synced from Google Calendar",
      description: "Delete this event in Google Calendar.",
    });
    expect(
      readOnlyNotice({ ...base, source: "BIRTHDAY" }, "delete")?.description,
    ).toMatch(/profile/i);
    expect(
      readOnlyNotice({ ...base, source: "SPORTS" }, "edit")?.description,
    ).toMatch(/Settings → Weather & Sports/);
  });
});
