import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "@/lib/types";
import { testMembers } from "@/test/fixtures";
import {
  renderWithUser,
  screen,
  seedFamilyStore,
  TEST_TIMEOUTS,
  typeAndWait,
  waitFor,
} from "@/test/test-utils";
import { EventForm } from "./event-form";
import { EventFormModal } from "./event-form-modal";

// The event form picks one or more people (Phase 4: Google keeps them all). The first
// picked leads and gives the event its colour; the form still sends it as memberId.

const [john, jane, alex] = testMembers.map((member) => member.id);

function pressed(name: string) {
  return screen.getByRole("button", { name }).getAttribute("aria-pressed");
}

describe("EventForm people", () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    seedFamilyStore({ name: "Test Family", members: testMembers });
  });

  it("adds an event for the person tapped, then for each one added", async () => {
    const { user } = renderWithUser(
      <EventForm
        mode="add"
        defaultValues={{ memberId: john }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    // John is only the form's guess: the first tap replaces him.
    await user.click(screen.getByRole("button", { name: "Jane" }));
    expect(pressed("John")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Alex" }));
    expect(pressed("Jane")).toBe("true");
    expect(pressed("Alex")).toBe("true");

    await typeAndWait(user, screen.getByLabelText(/event name/i), "Swim");
    await user.click(screen.getByRole("button", { name: /add event/i }));

    await waitFor(
      () =>
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({ memberId: jane, memberIds: [jane, alex] }),
        ),
      { timeout: TEST_TIMEOUTS.FORM_SUBMIT },
    );
  });

  it("edits a shared event starting from all its people, and the next leads when the lead goes", async () => {
    const { user } = renderWithUser(
      <EventForm
        mode="edit"
        defaultValues={{
          title: "Carpool",
          date: "2026-12-03",
          startTime: "08:00",
          endTime: "08:30",
          memberId: jane,
          memberIds: [jane, john],
        }}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    expect(pressed("Jane")).toBe("true");
    expect(pressed("John")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Jane" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: john, memberIds: [john] }),
      ),
    );
  });

  it("opens an event's edit form with all of its people", () => {
    const event: CalendarEvent = {
      id: "e1",
      title: "Carpool",
      startTime: "8:00 AM",
      endTime: "8:30 AM",
      date: new Date(2026, 11, 3),
      memberId: alex,
      memberIds: [alex, jane],
      isAllDay: false,
    };
    renderWithUser(
      <EventFormModal
        mode="edit"
        isOpen
        onClose={onCancel}
        onSubmit={onSubmit}
        event={event}
      />,
    );

    expect(pressed("Alex")).toBe("true");
    expect(pressed("Jane")).toBe("true");
    expect(pressed("John")).toBe("false");
  });
});
