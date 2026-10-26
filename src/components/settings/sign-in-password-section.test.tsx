import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/constants";
import type { ChangePasswordRequest } from "@/lib/types";
import { API_BASE, server, setupMswServer } from "@/test/mocks/server";
import { renderWithUser, screen, seedFamilyStore } from "@/test/test-utils";
import { SignInPasswordSection } from "./sign-in-password-section";

setupMswServer();

describe("SignInPasswordSection", () => {
  let sent: ChangePasswordRequest[];

  beforeEach(() => {
    seedFamilyStore({ name: "Test Family" });
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "old-token");
    sent = [];
    server.use(
      http.put(`${API_BASE}/auth/password`, async ({ request }) => {
        const body = (await request.json()) as ChangePasswordRequest;
        sent.push(body);
        if (body.currentPassword !== "old-password") {
          return HttpResponse.json(
            { message: "That isn't the password this family signs in with." },
            { status: 403 },
          );
        }
        return HttpResponse.json({
          data: {
            token: "fresh-token",
            family: {
              id: "family-1",
              name: "Test Family",
              members: [],
              createdAt: "2025-01-01T00:00:00.000Z",
            },
          },
          message: "Password changed",
        });
      }),
    );
  });

  async function fillIn(
    user: ReturnType<typeof renderWithUser>["user"],
    current: string,
    next: string,
    again: string,
  ) {
    await user.click(screen.getByRole("button", { name: "Change password" }));
    await user.type(screen.getByLabelText("Current password"), current);
    await user.type(screen.getByLabelText("New password"), next);
    await user.type(screen.getByLabelText("New password again"), again);
    await user.click(screen.getByRole("button", { name: "Save password" }));
  }

  it("says what the password is for and how a forgotten one is reset", () => {
    renderWithUser(<SignInPasswordSection />);

    expect(
      screen.getByRole("heading", { name: "Sign-in password" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/whoever runs the server can reset it/i),
    ).toBeInTheDocument();
  });

  it("changes the password and keeps this device signed in", async () => {
    const { user } = renderWithUser(<SignInPasswordSection />);

    await fillIn(user, "old-password", "a-new-password", "a-new-password");

    expect(
      await screen.findByText(
        "Password changed. Other phones, laptops and the wall will ask for the new one.",
      ),
    ).toBeInTheDocument();
    expect(sent).toEqual([
      { currentPassword: "old-password", newPassword: "a-new-password" },
    ]);
    // The old token stops working on the server, so this device keeps the new one.
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe("fresh-token");
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
  });

  it("says so when the current password is wrong, and stays signed in", async () => {
    const { user } = renderWithUser(<SignInPasswordSection />);

    await fillIn(user, "a-guess-123", "a-new-password", "a-new-password");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That isn't the password this family signs in with.",
    );
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe("old-token");
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
  });

  it("checks the new password before sending anything", async () => {
    const { user } = renderWithUser(<SignInPasswordSection />);

    await fillIn(user, "old-password", "short", "short");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "A password is 8 to 100 characters",
    );

    await user.clear(screen.getByLabelText("New password"));
    await user.type(screen.getByLabelText("New password"), "a-new-password");
    await user.clear(screen.getByLabelText("New password again"));
    await user.type(
      screen.getByLabelText("New password again"),
      "a-new-pasword",
    );
    await user.click(screen.getByRole("button", { name: "Save password" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The new passwords don't match",
    );

    expect(sent).toEqual([]);
  });

  it("reports a half-typed password as unsaved until it is cancelled", async () => {
    const onDirtyChange = vi.fn();
    const { user } = renderWithUser(
      <SignInPasswordSection onDirtyChange={onDirtyChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Change password" }));
    await user.type(screen.getByLabelText("New password"), "a");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });
});
