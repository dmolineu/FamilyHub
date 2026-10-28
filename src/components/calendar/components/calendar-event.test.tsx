import type { CalendarEvent } from "@/lib/types";
import { render, screen } from "@/test/test-utils";
import { CalendarEventCard } from "./calendar-event";

vi.mock("@/api", () => ({
  useFamilyMembers: () => [
    { id: "m1", name: "Alice", color: "coral" as const },
  ],
}));

const baseEvent: CalendarEvent = {
  id: "e1",
  title: "Test Event",
  startTime: "09:00",
  endTime: "10:00",
  date: new Date("2026-01-15"),
  memberId: "m1",
  isAllDay: false,
};

describe("CalendarEventCard", () => {
  it("does not show Google icon for native events", () => {
    render(<CalendarEventCard event={baseEvent} />);
    expect(
      screen.queryByLabelText("Google Calendar event"),
    ).not.toBeInTheDocument();
  });

  it("does not show Google icon when source is NATIVE", () => {
    render(<CalendarEventCard event={{ ...baseEvent, source: "NATIVE" }} />);
    expect(
      screen.queryByLabelText("Google Calendar event"),
    ).not.toBeInTheDocument();
  });

  it("shows Google icon when source is GOOGLE", () => {
    render(<CalendarEventCard event={{ ...baseEvent, source: "GOOGLE" }} />);
    expect(screen.getByLabelText("Google Calendar event")).toBeInTheDocument();
  });

  it("shows Google icon in all variants", () => {
    const googleEvent = { ...baseEvent, source: "GOOGLE" as const };

    const { rerender } = render(
      <CalendarEventCard event={googleEvent} variant="default" />,
    );
    expect(screen.getByLabelText("Google Calendar event")).toBeInTheDocument();

    rerender(<CalendarEventCard event={googleEvent} variant="large" />);
    expect(screen.getByLabelText("Google Calendar event")).toBeInTheDocument();

    rerender(<CalendarEventCard event={googleEvent} variant="compact" />);
    expect(screen.getByLabelText("Google Calendar event")).toBeInTheDocument();
  });

  it("fits a short event on one line with its title and start time", () => {
    render(
      <CalendarEventCard
        event={{
          ...baseEvent,
          title: "Drop-off",
          startTime: "7:30 AM",
          endTime: "8:00 AM",
        }}
        variant="slim"
      />,
    );

    const card = screen.getByRole("button", { name: /Drop-off/ });
    expect(card).toHaveTextContent("Drop-off");
    expect(card).toHaveTextContent("7:30 AM");
    expect(card).not.toHaveTextContent("8:00 AM");
    expect(
      screen.getByRole("heading", { name: "Drop-off" }),
    ).toBeInTheDocument();
  });
});
