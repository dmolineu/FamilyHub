import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FamilyMember } from "@/lib/types";
import { render, screen, seedFamilyStore } from "@/test/test-utils";
import { BirthdaysCard } from "./birthdays-card";

const MEMBERS: FamilyMember[] = [
  {
    id: "m1",
    name: "Maya",
    color: "teal",
    birthday: { month: 10, day: 28, year: 2016 },
  },
  { id: "m2", name: "Dad", color: "coral", birthday: { month: 11, day: 3 } },
  { id: "m3", name: "Leo", color: "green", birthday: { month: 6, day: 1 } },
  { id: "m4", name: "Mom", color: "pink" },
];

function seed(members: FamilyMember[]) {
  seedFamilyStore({
    name: "Test Family",
    timezone: "America/Los_Angeles",
    members,
  });
}

describe("BirthdaysCard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-25T19:00:00Z")); // noon in Los Angeles
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lists birthdays in the next 30 days, soonest first", () => {
    seed(MEMBERS);
    render(<BirthdaysCard />);

    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual([
      expect.stringContaining("Maya turns 10 · In 3 days"),
      expect.stringContaining("Dad · In 9 days"),
    ]);
    expect(screen.queryByText(/Leo/)).not.toBeInTheDocument();
  });

  it("celebrates on the day", () => {
    seed([
      {
        id: "m1",
        name: "Maya",
        color: "teal",
        birthday: { month: 10, day: 25, year: 2016 },
      },
    ]);
    render(<BirthdaysCard />);

    expect(
      screen.getByRole("heading", { name: "Happy birthday, Maya!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Maya turns 10 today")).toBeInTheDocument();
  });

  it("renders nothing when no birthday is coming up", () => {
    seed([{ id: "m4", name: "Mom", color: "pink" }]);
    const { container } = render(<BirthdaysCard />);
    expect(container).toBeEmptyDOMElement();
  });
});
