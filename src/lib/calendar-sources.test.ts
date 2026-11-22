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
  it("the family's events are editable when a signed-in Google account may change them", () => {
    expect(isReadOnlyEvent(base)).toBe(false);
    expect(isReadOnlyEvent({ ...base, source: "NATIVE" })).toBe(false);
    // Phase 4: every API event comes from Google; canEdit says whether the hub may write it.
    expect(isReadOnlyEvent({ ...base, source: "GOOGLE", canEdit: true })).toBe(
      false,
    );
    expect(isReadOnlyEvent({ ...base, source: "GOOGLE", canEdit: false })).toBe(
      true,
    );
    expect(isReadOnlyEvent({ ...base, source: "GOOGLE" })).toBe(true);
    expect(isReadOnlyEvent({ ...base, source: "BIRTHDAY" })).toBe(true);
    expect(isReadOnlyEvent({ ...base, source: "SPORTS" })).toBe(true);
  });

  it("explains where a read-only entry is changed", () => {
    expect(readOnlyNotice(base, "edit")).toBeNull();
    expect(
      readOnlyNotice({ ...base, source: "GOOGLE", canEdit: true }, "edit"),
    ).toBeNull();
    expect(
      readOnlyNotice({ ...base, source: "GOOGLE", canEdit: false }, "edit"),
    ).toEqual({
      title: "Can't be changed here",
      description:
        "No one signed in to the hub may change this calendar. Edit it in Google Calendar, or connect Google again in Family Settings.",
    });
    expect(
      readOnlyNotice({ ...base, source: "GOOGLE", canEdit: false }, "delete")
        ?.title,
    ).toBe("Can't be changed here");
    expect(
      readOnlyNotice({ ...base, source: "BIRTHDAY" }, "delete")?.description,
    ).toMatch(/profile/i);
    expect(
      readOnlyNotice({ ...base, source: "SPORTS" }, "edit")?.description,
    ).toMatch(/Settings → Weather & Sports/);
  });
});
