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
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        title: "Take out trash",
        assignedToMemberIds: ["member-1", "member-2"],
        cadence: "WEEKLY",
        daysOfWeek: [],
      });
    }
  });

  it("keeps the chosen days for a weekly chore and defaults to none", () => {
    const weekly = choreFormSchema.safeParse({
      title: "Take out bins",
      cadence: "WEEKLY",
      daysOfWeek: ["MONDAY", "THURSDAY"],
    });
    expect(weekly.success).toBe(true);
    if (weekly.success) {
      expect(weekly.data.daysOfWeek).toEqual(["MONDAY", "THURSDAY"]);
    }

    const daily = choreFormSchema.safeParse({
      title: "Dishes",
      cadence: "DAILY",
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
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assignedToMemberIds).toEqual([]);
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
