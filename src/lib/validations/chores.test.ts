import { describe, expect, it } from "vitest";
import { choreFormSchema } from "./chores";

describe("choreFormSchema", () => {
  it("requires title and cadence", () => {
    const result = choreFormSchema.safeParse({
      title: "",
      assignedToMemberIds: [],
      cadence: undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(
        expect.arrayContaining(["title", "cadence"]),
      );
    }
  });

  it("trims title and keeps every selected member", () => {
    const result = choreFormSchema.safeParse({
      title: "  Take out trash  ",
      assignedToMemberIds: ["member-1", "member-2"],
      cadence: "WEEKLY",
      points: "4",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        title: "Take out trash",
        assignedToMemberIds: ["member-1", "member-2"],
        cadence: "WEEKLY",
        daysOfWeek: [],
        points: 4,
      });
    }
  });

  it("keeps the chosen days for a weekly chore and defaults to none", () => {
    const weekly = choreFormSchema.safeParse({
      title: "Take out bins",
      cadence: "WEEKLY",
      daysOfWeek: ["MONDAY", "THURSDAY"],
      points: 2,
    });
    expect(weekly.success).toBe(true);
    if (weekly.success) {
      expect(weekly.data.daysOfWeek).toEqual(["MONDAY", "THURSDAY"]);
    }

    const daily = choreFormSchema.safeParse({
      title: "Dishes",
      cadence: "DAILY",
      points: 2,
    });
    expect(daily.success).toBe(true);
    if (daily.success) {
      expect(daily.data.daysOfWeek).toEqual([]);
    }
  });

  it("treats no selected members as a chore for anyone", () => {
    const result = choreFormSchema.safeParse({
      title: "Feed the dog",
      cadence: "DAILY",
      points: 1,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assignedToMemberIds).toEqual([]);
    }
  });

  it("requires whole points from 1 to 100, with no default", () => {
    for (const points of [undefined, "", "0", "101", "2.5", "lots"]) {
      const result = choreFormSchema.safeParse({
        title: "Dishes",
        cadence: "DAILY",
        points,
      });
      expect(result.success, String(points)).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Give this chore 1 to 100 points",
        );
      }
    }
  });

  it("rejects unsupported cadences", () => {
    const result = choreFormSchema.safeParse({
      title: "Take out trash",
      assignedToMemberIds: ["member-1"],
      cadence: "YEARLY",
    });

    expect(result.success).toBe(false);
  });
});
