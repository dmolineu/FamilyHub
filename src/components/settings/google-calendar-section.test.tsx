import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { API_BASE, server, setupMswServer } from "@/test/mocks/server";
import { render, renderWithUser, screen, waitFor } from "@/test/test-utils";
import { GoogleCalendarSection } from "./google-calendar-section";

const mockToast = vi.fn();
vi.mock("@/components/ui/toaster", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

const MEMBER_ID = "member-123";

setupMswServer();

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("GoogleCalendarSection", () => {
  describe("disconnected state", () => {
    beforeEach(() => {
      server.use(
        http.get(`${API_BASE}/google/status/${MEMBER_ID}`, () =>
          HttpResponse.json({
            data: { connected: false, calendars: [] },
            message: null,
          }),
        ),
      );
    });

    it("shows connect button when member has email", async () => {
      render(
        <GoogleCalendarSection
          memberId={MEMBER_ID}
          memberEmail="test@example.com"
          memberName="Alice"
        />,
        { wrapper: createWrapper() },
      );

      expect(
        await screen.findByRole("button", { name: /connect google calendar/i }),
      ).toBeInTheDocument();
    });

    it("says Google is not set up yet instead of opening a broken Google page", async () => {
      mockToast.mockClear();
      server.use(
        http.get(`${API_BASE}/google/auth`, () =>
          HttpResponse.json(
            {
              message:
                "Google Calendar isn't set up on this server yet. An administrator needs to add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
            },
            { status: 503 },
          ),
        ),
      );
      const { user } = renderWithUser(
        <GoogleCalendarSection
          memberId={MEMBER_ID}
          memberEmail="test@example.com"
          memberName="Alice"
        />,
        { wrapper: createWrapper() },
      );

      await user.click(
        await screen.findByRole("button", { name: /connect google calendar/i }),
      );

      await waitFor(() =>
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Google Calendar isn't set up yet",
            description: expect.stringContaining("GOOGLE_CLIENT_ID"),
          }),
        ),
      );
    });

    it("disables connect button when member has no email", async () => {
      render(
        <GoogleCalendarSection
          memberId={MEMBER_ID}
          memberEmail=""
          memberName="Alice"
        />,
        { wrapper: createWrapper() },
      );

      const button = await screen.findByRole("button", {
        name: /connect google calendar/i,
      });
      expect(button).toBeDisabled();
      expect(screen.getByText(/add an email/i)).toBeInTheDocument();
    });
  });

  describe("connected state", () => {
    beforeEach(() => {
      server.use(
        http.get(`${API_BASE}/google/status/${MEMBER_ID}`, () =>
          HttpResponse.json({
            data: {
              connected: true,
              calendars: [
                {
                  id: "primary",
                  name: "Main Calendar",
                  enabled: true,
                  lastSyncedAt: "2026-03-20T10:00:00Z",
                },
              ],
            },
            message: null,
          }),
        ),
      );
    });

    it("shows connected status and action buttons", async () => {
      render(
        <GoogleCalendarSection
          memberId={MEMBER_ID}
          memberEmail="test@example.com"
          memberName="Alice"
        />,
        { wrapper: createWrapper() },
      );

      expect(await screen.findByText(/connected/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /choose calendars/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /sync now/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /disconnect/i }),
      ).toBeInTheDocument();
    });
  });
});
