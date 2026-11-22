import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@/test/mocks/server";
import { googleCalendarService } from "./google-calendar.service";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const MEMBER_ID = "member-123";

describe("googleCalendarService", () => {
  describe("getAuthUrl", () => {
    it("returns the OAuth redirect URL", async () => {
      server.use(
        http.get("*/google/auth", () =>
          HttpResponse.json({
            data: { url: "https://accounts.google.com/o/oauth2/v2/auth?..." },
            message: null,
          }),
        ),
      );

      const result = await googleCalendarService.getAuthUrl(MEMBER_ID);
      expect(result.data.url).toContain("accounts.google.com");
    });
  });

  describe("getConnectionStatus", () => {
    it("returns connection status for a member", async () => {
      server.use(
        http.get(`*/google/status/${MEMBER_ID}`, () =>
          HttpResponse.json({
            data: { connected: true, calendars: [] },
            message: null,
          }),
        ),
      );

      const result = await googleCalendarService.getConnectionStatus(MEMBER_ID);
      expect(result.data.connected).toBe(true);
    });
  });

  describe("disconnect", () => {
    it("calls DELETE endpoint", async () => {
      server.use(
        http.delete(
          `*/google/disconnect/${MEMBER_ID}`,
          () => new HttpResponse(null, { status: 204 }),
        ),
      );

      await expect(
        googleCalendarService.disconnect(MEMBER_ID),
      ).resolves.not.toThrow();
    });
  });

  describe("getFamilyCalendars", () => {
    it("returns every calendar the family's accounts can see, and the default", async () => {
      const settings = {
        calendars: [
          {
            id: "cal-1",
            googleCalendarId: "hub@group.calendar.google.com",
            summary: "Hub",
            color: "#9fc6e7",
            timeZone: "America/Los_Angeles",
            enabled: true,
            accessRole: "owner",
            writable: true,
            laneMemberIds: ["m1"],
            isDefault: true,
            lastSyncedAt: null,
            lastSyncError: null,
          },
        ],
        defaultCalendarId: "cal-1",
      };
      server.use(
        http.get("*/google/calendars", () =>
          HttpResponse.json({ data: settings, message: null }),
        ),
      );

      const result = await googleCalendarService.getFamilyCalendars();
      expect(result.data).toEqual(settings);
    });
  });

  describe("updateFamilyCalendars", () => {
    it("sends which calendars show, their lanes and the default", async () => {
      let capturedBody: unknown;
      server.use(
        http.put("*/google/calendars", async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            data: { calendars: [], defaultCalendarId: "cal-1" },
            message: null,
          });
        }),
      );

      const update = {
        calendars: [{ id: "cal-1", enabled: true, laneMemberIds: ["m1"] }],
        defaultCalendarId: "cal-1",
      };
      await googleCalendarService.updateFamilyCalendars(update);
      expect(capturedBody).toEqual(update);
    });
  });

  describe("getHealth", () => {
    it("reads whether the calendar is up to date", async () => {
      server.use(
        http.get("*/google/health", () =>
          HttpResponse.json({
            data: {
              connected: true,
              needsReauth: true,
              writeScopeMissing: false,
              oldestSyncAt: null,
              calendars: [],
            },
            message: null,
          }),
        ),
      );

      const result = await googleCalendarService.getHealth();
      expect(result.data.needsReauth).toBe(true);
    });
  });

  describe("syncCalendar", () => {
    it("calls POST endpoint and returns 202 Accepted", async () => {
      server.use(
        http.post(`*/google/sync/${MEMBER_ID}`, () =>
          HttpResponse.json(
            {
              data: null,
              message: "Sync started",
            },
            { status: 202 },
          ),
        ),
      );

      const result = await googleCalendarService.syncCalendar(MEMBER_ID);
      expect(result).toEqual({ data: null, message: "Sync started" });
    });
  });
});
