import { screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { API_BASE, server, setupMswServer } from "@/test/mocks/server";
import { render } from "@/test/test-utils";
import { GoogleStatusBanner } from "./google-status-banner";

setupMswServer();

// Phase 4: the calendar reads a copy of Google. The banner says when that copy is old
// (Google unreachable for a while) or when an account must connect again; otherwise
// it shows nothing.

function health(overrides: Record<string, unknown>) {
  server.use(
    http.get(`${API_BASE}/google/health`, () =>
      HttpResponse.json({
        data: {
          connected: true,
          needsReauth: false,
          writeScopeMissing: false,
          oldestSyncAt: new Date().toISOString(),
          calendars: [],
          ...overrides,
        },
        message: "",
      }),
    ),
  );
}

describe("GoogleStatusBanner", () => {
  it("shows nothing while the calendar is up to date", async () => {
    health({});
    const { container } = render(<GoogleStatusBanner />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it("asks for Google to be connected again before events can be changed", async () => {
    health({ writeScopeMissing: true });
    render(<GoogleStatusBanner />);
    expect(
      await screen.findByText(/connect Google again in Family Settings/i),
    ).toBeInTheDocument();
  });

  it("says how old the calendar is when Google has not been reached for a while", async () => {
    health({
      oldestSyncAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    });
    render(<GoogleStatusBanner />);
    expect(
      await screen.findByText(/last updated 25 minutes ago/i),
    ).toBeInTheDocument();
  });
});
