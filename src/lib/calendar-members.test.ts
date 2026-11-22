import { describe, expect, it } from "vitest";
import { eventMemberNames, otherEventMembers } from "./calendar-members";

// A shared event names everyone it is for; its lead (memberId) comes first and gives it
// its colour, and the others are shown beside it.

const members = [
  { id: "m1", name: "Alice" },
  { id: "m2", name: "Bob" },
  { id: "m3", name: "Cara" },
];

describe("eventMemberNames", () => {
  it("names the lead first, then the others in the event's order", () => {
    expect(
      eventMemberNames({ memberId: "m3", memberIds: ["m3", "m1"] }, members),
    ).toBe("Cara, Alice");
    expect(eventMemberNames({ memberId: "m2" }, members)).toBe("Bob");
  });

  it("leaves out people no longer in the family", () => {
    expect(
      eventMemberNames({ memberId: "m1", memberIds: ["m1", "gone"] }, members),
    ).toBe("Alice");
  });
});

describe("otherEventMembers", () => {
  it("is everyone but the lead, and no one for a one-person event", () => {
    expect(
      otherEventMembers(
        { memberId: "m1", memberIds: ["m1", "m2", "m3"] },
        members,
      ).map((member) => member.name),
    ).toEqual(["Bob", "Cara"]);
    expect(otherEventMembers({ memberId: "m1" }, members)).toEqual([]);
  });
});
