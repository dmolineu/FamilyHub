import { format } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  birthdayEventsInRange,
  countdownLabel,
  nextBirthday,
  todayInZone,
  upcomingBirthdays,
} from "./birthdays";

const TODAY = { year: 2026, month: 10, day: 25 };

describe("todayInZone", () => {
  it("is the calendar date in the family's zone, not UTC's", () => {
    // 05:30Z on the 26th is still the evening of the 25th in Los Angeles.
    expect(
      todayInZone(new Date("2026-10-26T05:30:00Z"), "America/Los_Angeles"),
    ).toEqual({ year: 2026, month: 10, day: 25 });
  });
});

describe("nextBirthday", () => {
  it("counts the days to this year's birthday", () => {
    expect(nextBirthday({ month: 11, day: 3 }, TODAY)).toEqual({
      year: 2026,
      month: 11,
      day: 3,
      daysUntil: 9,
      turning: null,
    });
  });

  it("is zero days on the day itself", () => {
    expect(nextBirthday({ month: 10, day: 25 }, TODAY).daysUntil).toBe(0);
  });

  it("rolls into next year once this year's birthday has passed", () => {
    const next = nextBirthday({ month: 1, day: 5 }, TODAY);
    expect(next).toMatchObject({ year: 2027, month: 1, day: 5, daysUntil: 72 });
  });

  it("says how old someone turns when the year is known", () => {
    expect(nextBirthday({ month: 3, day: 14, year: 2016 }, TODAY).turning).toBe(
      11,
    );
    expect(
      nextBirthday({ month: 10, day: 25, year: 2016 }, TODAY).turning,
    ).toBe(10);
  });

  it("celebrates 29 February on 28 February in common years", () => {
    const common = nextBirthday({ month: 2, day: 29 }, TODAY);
    expect(common).toMatchObject({ year: 2027, month: 2, day: 28 });
    const leap = nextBirthday(
      { month: 2, day: 29 },
      { year: 2027, month: 3, day: 1 },
    );
    expect(leap).toMatchObject({ year: 2028, month: 2, day: 29 });
  });
});

describe("countdownLabel", () => {
  it("reads naturally", () => {
    expect(countdownLabel(0)).toBe("Today");
    expect(countdownLabel(1)).toBe("Tomorrow");
    expect(countdownLabel(9)).toBe("In 9 days");
  });
});

const members = [
  { id: "m1", name: "Maya", birthday: { month: 10, day: 28, year: 2016 } },
  { id: "m2", name: "Dad", birthday: { month: 11, day: 3 } },
  { id: "m3", name: "Leo", birthday: { month: 6, day: 1, year: 2019 } },
  { id: "m4", name: "Mom", birthday: null },
];

describe("upcomingBirthdays", () => {
  it("lists birthdays within the window, soonest first", () => {
    expect(
      upcomingBirthdays(members, TODAY, 30).map((b) => [
        b.member.name,
        b.daysUntil,
        b.turning,
      ]),
    ).toEqual([
      ["Maya", 3, 10],
      ["Dad", 9, null],
    ]);
  });
});

describe("birthdayEventsInRange", () => {
  it("makes read-only all-day entries for every birthday in the range", () => {
    const events = birthdayEventsInRange(members, "2026-10-01", "2027-06-30");
    expect(
      events.map((e) => [
        e.id,
        e.title,
        format(e.date, "yyyy-MM-dd"),
        e.memberId,
      ]),
    ).toEqual([
      ["birthday:m1:2026", "Maya's birthday (turns 10)", "2026-10-28", "m1"],
      ["birthday:m2:2026", "Dad's birthday", "2026-11-03", "m2"],
      ["birthday:m3:2027", "Leo's birthday (turns 8)", "2027-06-01", "m3"],
    ]);
    expect(events.every((e) => e.isAllDay && e.source === "BIRTHDAY")).toBe(
      true,
    );
  });
});
