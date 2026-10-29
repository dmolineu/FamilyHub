import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type {
  FamilyMember,
  SetMemberPinRequest,
  SetMemberRoleRequest,
} from "@/lib/types";
import { API_BASE, server, setupMswServer } from "@/test/mocks/server";
import { renderWithUser, screen, seedFamilyStore } from "@/test/test-utils";
import { MemberRoleSection } from "./member-role-section";

setupMswServer();

const MOM: FamilyMember = {
  id: "mom",
  name: "Mom",
  color: "coral",
  role: "PARENT",
  hasPin: false,
};
const MAYA: FamilyMember = {
  id: "maya",
  name: "Maya",
  color: "teal",
  role: "PARENT",
  hasPin: false,
};

describe("MemberRoleSection", () => {
  let roleRequest: SetMemberRoleRequest | null;
  let pinRequest: SetMemberPinRequest | null;

  beforeEach(() => {
    seedFamilyStore({ members: [MOM, MAYA] });
    roleRequest = null;
    pinRequest = null;
    server.use(
      http.put(`${API_BASE}/family/members/:id/role`, async ({ request }) => {
        roleRequest = (await request.json()) as SetMemberRoleRequest;
        if (roleRequest.password !== "family-pass") {
          return HttpResponse.json(
            { message: "That isn't the password this family signs in with." },
            { status: 403 },
          );
        }
        return HttpResponse.json({
          data: { ...MAYA, role: roleRequest.role, hasPin: false },
          message: "Role updated",
        });
      }),
      http.put(`${API_BASE}/family/members/:id/pin`, async ({ request }) => {
        pinRequest = (await request.json()) as SetMemberPinRequest;
        return new HttpResponse(null, { status: 204 });
      }),
    );
  });

  it("makes a member a kid once the family password is entered", async () => {
    const { user } = renderWithUser(<MemberRoleSection memberId="maya" />);

    expect(screen.getByRole("button", { name: "Parent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Kid" }));
    await user.type(
      screen.getByLabelText("Family sign-in password"),
      "family-pass",
    );
    await user.click(screen.getByRole("button", { name: "Make Maya a kid" }));

    expect(roleRequest).toEqual({ role: "KID", password: "family-pass" });
    expect(
      await screen.findByRole("button", { name: "Kid", pressed: true }),
    ).toBeInTheDocument();
    // Kids have no PIN, so the PIN controls go away.
    expect(
      screen.queryByRole("button", { name: "Set PIN" }),
    ).not.toBeInTheDocument();
  });

  it("shows the server's answer to a wrong family password", async () => {
    const { user } = renderWithUser(<MemberRoleSection memberId="maya" />);

    await user.click(screen.getByRole("button", { name: "Kid" }));
    await user.type(screen.getByLabelText("Family sign-in password"), "nope");
    await user.click(screen.getByRole("button", { name: "Make Maya a kid" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That isn't the password this family signs in with.",
    );
  });

  it("sets a parent's PIN with the family password", async () => {
    const { user } = renderWithUser(<MemberRoleSection memberId="mom" />);

    expect(screen.getByText("No PIN yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Set PIN" }));
    await user.type(screen.getByLabelText("New PIN"), "2468");
    await user.type(
      screen.getByLabelText("Family sign-in password"),
      "family-pass",
    );
    await user.click(screen.getByRole("button", { name: "Save PIN" }));

    expect(pinRequest).toEqual({ password: "family-pass", pin: "2468" });
    expect(await screen.findByText("PIN set")).toBeInTheDocument();
  });

  it("refuses a PIN that is not 4 digits without asking the server", async () => {
    const { user } = renderWithUser(<MemberRoleSection memberId="mom" />);

    await user.click(screen.getByRole("button", { name: "Set PIN" }));
    await user.type(screen.getByLabelText("New PIN"), "12");
    await user.type(
      screen.getByLabelText("Family sign-in password"),
      "family-pass",
    );
    await user.click(screen.getByRole("button", { name: "Save PIN" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A PIN is 4 digits",
    );
    expect(pinRequest).toBeNull();
  });

  it("takes exactly four digits for a new PIN", async () => {
    const { user } = renderWithUser(<MemberRoleSection memberId="mom" />);

    await user.click(screen.getByRole("button", { name: "Set PIN" }));
    // The pad checks a PIN at its fourth digit, so a longer one could never be entered.
    await user.type(screen.getByLabelText("New PIN"), "246813");

    expect(screen.getByLabelText("New PIN")).toHaveValue("2468");
    expect(screen.getByText(/^4 digits\./)).toBeInTheDocument();
  });
});

describe("MemberRoleSection password managers", () => {
  it("never invites the browser to fill the sign-in password into the PIN", async () => {
    seedFamilyStore({ members: [MOM] });
    const { user } = renderWithUser(<MemberRoleSection memberId="mom" />);

    await user.click(screen.getByRole("button", { name: "Set PIN" }));

    // Chrome ignores autocomplete="off" on password fields and would put the
    // saved sign-in password here; "new-password" tells it this is a new secret.
    expect(screen.getByLabelText("New PIN")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
    expect(screen.getByLabelText("Family sign-in password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });
});
