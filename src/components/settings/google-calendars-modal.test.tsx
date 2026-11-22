import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { createTestFamily, testMembers } from "@/test/fixtures";
import {
  API_BASE,
  seedMockFamily,
  server,
  setupMswServer,
} from "@/test/mocks/server";
import { renderWithUser } from "@/test/test-utils";
import { GoogleCalendarsModal } from "./google-calendars-modal";

setupMswServer();

// Phase 4: the family's Google calendars, chosen once for the whole family: which ones
// show, whose lanes their events go in, and which one new events go on.

const HUB = "cal-hub";
const SCHOOL = "cal-school";

function settings() {
  return {
    calendars: [
      {
        id: HUB,
        googleCalendarId: "hub@group.calendar.google.com",
        summary: "Molly Hub",
        color: "#9fc6e7",
        timeZone: "America/Los_Angeles",
        enabled: true,
        accessRole: "owner",
        writable: true,
        laneMemberIds: [testMembers[0].id],
        isDefault: true,
        lastSyncedAt: "2026-11-21T18:00:00Z",
        lastSyncError: null,
      },
      {
        id: SCHOOL,
        googleCalendarId: "school@import.calendar.google.com",
        summary: "School",
        color: "#ff887c",
        timeZone: "America/Chicago",
        enabled: false,
        accessRole: "reader",
        writable: false,
        laneMemberIds: [],
        isDefault: false,
        lastSyncedAt: null,
        lastSyncError: null,
      },
    ],
    defaultCalendarId: HUB,
  };
}

describe("GoogleCalendarsModal", () => {
  let saved: unknown = null;

  beforeEach(() => {
    saved = null;
    seedMockFamily(createTestFamily(testMembers));
    server.use(
      http.get(`${API_BASE}/google/calendars`, () =>
        HttpResponse.json({ data: settings(), message: "" }),
      ),
      http.put(`${API_BASE}/google/calendars`, async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({
          data: settings(),
          message: "Calendars updated",
        });
      }),
    );
  });

  it("lists every calendar, whether it shows, and whether the hub may change it", async () => {
    renderWithUser(<GoogleCalendarsModal open onOpenChange={vi.fn()} />);

    expect(await screen.findByText("Molly Hub")).toBeInTheDocument();
    expect(screen.getByLabelText("Show Molly Hub")).toBeChecked();
    expect(screen.getByLabelText("Show School")).not.toBeChecked();
    expect(screen.getByText("Can change")).toBeInTheDocument();
    expect(screen.getByText("View only")).toBeInTheDocument();
    expect(screen.getByLabelText("New events go on Molly Hub")).toBeChecked();
    // Only a calendar the hub may write to can take new events.
    expect(screen.getByLabelText("New events go on School")).toBeDisabled();
  });

  it("saves which calendars show, whose lanes they fill and where new events go", async () => {
    const onOpenChange = vi.fn();
    const { user } = renderWithUser(
      <GoogleCalendarsModal open onOpenChange={onOpenChange} />,
    );

    await user.click(await screen.findByLabelText("Show School"));
    await user.click(screen.getByLabelText(`School: ${testMembers[1].name}`));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saved).not.toBeNull());
    expect(saved).toEqual({
      calendars: [
        { id: HUB, enabled: true, laneMemberIds: [testMembers[0].id] },
        { id: SCHOOL, enabled: true, laneMemberIds: [testMembers[1].id] },
      ],
      defaultCalendarId: HUB,
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
