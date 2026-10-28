import { afterEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent, FamilyMember } from "@/lib/types";
import { useDisplayStore } from "@/stores/display-store";
import { render, screen, seedFamilyStore } from "@/test/test-utils";
import { WeeklyCalendar } from "./weekly-calendar";

const members: FamilyMember[] = [{ id: "m1", name: "Alice", color: "coral" }];

function event(
  id: string,
  title: string,
  start: string,
  end: string,
): CalendarEvent {
  return {
    id,
    title,
    startTime: start,
    endTime: end,
    date: new Date(2026, 6, 8),
    memberId: "m1",
    isAllDay: false,
    source: "NATIVE",
  };
}

/** The positioned box an event card sits in. */
function box(title: string): HTMLElement {
  const card = screen.getByRole("button", { name: new RegExp(title) });
  const positioned = card.closest<HTMLElement>("[data-event-box]");
  if (!positioned) throw new Error(`No box for ${title}`);
  return positioned;
}

describe("WeeklyCalendar", () => {
  it("puts overlapping events side by side instead of on top of each other", () => {
    seedFamilyStore({ name: "F", members });
    render(
      <WeeklyCalendar
        events={[
          event("a", "Swim", "9:00 AM", "10:00 AM"),
          event("b", "Piano", "9:30 AM", "10:30 AM"),
          event("c", "Lunch", "12:00 PM", "1:00 PM"),
        ]}
        currentDate={new Date(2026, 6, 8)}
        filter={{ selectedMembers: ["m1"], showAllDayEvents: true }}
        onEventClick={vi.fn()}
      />,
    );

    expect(box("Swim").style.left).toBe("0%");
    expect(box("Swim").style.width).toBe("50%");
    expect(box("Piano").style.left).toBe("50%");
    expect(box("Piano").style.width).toBe("50%");
    // An event with nothing beside it keeps the whole column.
    expect(box("Lunch").style.left).toBe("0%");
    expect(box("Lunch").style.width).toBe("100%");
  });

  describe("short events", () => {
    function renderShort() {
      seedFamilyStore({ name: "F", members });
      render(
        <WeeklyCalendar
          events={[event("a", "Drop-off", "9:00 AM", "9:30 AM")]}
          currentDate={new Date(2026, 6, 8)}
          filter={{ selectedMembers: ["m1"], showAllDayEvents: true }}
          onEventClick={vi.fn()}
        />,
      );
      return screen.getByRole("button", { name: /Drop-off/ });
    }

    afterEach(() => {
      useDisplayStore.setState({ mode: "standard" });
    });

    it("shrink to one line on a wall so the title is not cut off", () => {
      useDisplayStore.setState({ mode: "wall" });
      const card = renderShort();
      expect(card).toHaveTextContent("9:00 AM");
      expect(card).not.toHaveTextContent("9:30 AM");
    });

    it("keep the usual card on phones and laptops", () => {
      const card = renderShort();
      expect(card).toHaveTextContent("9:00 AM - 9:30 AM");
    });
  });
});
