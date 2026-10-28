import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE, server, setupMswServer } from "@/test/mocks/server";
import { render, renderWithUser, screen } from "@/test/test-utils";
import { LoginForm } from "./login-form";

let mockIsMobile = true;
vi.mock("@/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks")>();
  return { ...actual, useIsMobile: () => mockIsMobile };
});

setupMswServer();

describe("LoginForm", () => {
  beforeEach(() => {
    mockIsMobile = true;
  });

  it("does not autofocus the username field on mobile", () => {
    render(<LoginForm onSwitchToOnboarding={vi.fn()} />);
    expect(screen.getByLabelText(/username/i)).not.toBe(document.activeElement);
  });

  it("autofocuses the username field on desktop", () => {
    mockIsMobile = false;
    render(<LoginForm onSwitchToOnboarding={vi.fn()} />);
    expect(screen.getByLabelText(/username/i)).toBe(document.activeElement);
  });

  it("says how long to wait after too many wrong passwords", async () => {
    server.use(
      http.post(`${API_BASE}/auth/login`, () =>
        HttpResponse.json(
          {
            message:
              "Too many wrong passwords. Try again in 15 minutes, or reset it on the server (reset-password).",
          },
          { status: 429 },
        ),
      ),
    );
    const { user } = renderWithUser(
      <LoginForm onSwitchToOnboarding={vi.fn()} />,
    );
    await user.type(screen.getByLabelText(/username/i), "molineus");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(
      await screen.findByText(
        /too many wrong passwords\. try again in 15 minutes/i,
      ),
    ).toBeInTheDocument();
  });
});
