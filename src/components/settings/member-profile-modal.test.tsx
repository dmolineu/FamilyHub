import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { FamilyMember, UpdateMemberRequest } from "@/lib/types";
import { API_BASE, setupMswServer } from "@/test/mocks/server";
import {
  render,
  renderWithUser,
  screen,
  seedFamilyStore,
  TEST_TIMEOUTS,
  waitFor,
} from "@/test/test-utils";
import { MemberProfileModal } from "./member-profile-modal";

// The responsive wrapper switches on useIsMobile; default to desktop so the
// existing assertions exercise the centered dialog.
let mockIsMobile = false;
vi.mock("@/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks")>();
  return { ...actual, useIsMobile: () => mockIsMobile };
});

setupMswServer();

const testMember: FamilyMember = {
  id: "member-1",
  name: "Alice",
  color: "coral",
  avatarUrl: "https://example.com/avatar.jpg",
  email: "alice@example.com",
  birthday: { month: 11, day: 3, year: 2016 },
};

const testMembers: FamilyMember[] = [
  testMember,
  { id: "member-2", name: "Bob", color: "teal" },
];

function seedFamily() {
  seedFamilyStore({ name: "Test Family", members: testMembers });
}

describe("MemberProfileModal", () => {
  it("form submit preserves avatarUrl from existing member data", async () => {
    seedFamily();
    let capturedBody: UpdateMemberRequest | null = null;

    const { server } = await import("@/test/mocks/server");
    server.use(
      http.put(`${API_BASE}/family/members/:id`, async ({ request }) => {
        capturedBody = (await request.json()) as UpdateMemberRequest;
        return HttpResponse.json({
          data: { ...testMember, ...capturedBody },
          message: "Member updated",
        });
      }),
    );

    const { user } = renderWithUser(
      <MemberProfileModal
        open={true}
        onOpenChange={vi.fn()}
        memberId="member-1"
      />,
    );

    // Change name to make form dirty
    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Alice Updated");

    await waitFor(
      () => {
        expect(nameInput).toHaveValue("Alice Updated");
      },
      { timeout: TEST_TIMEOUTS.FORM_STATE },
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(
      () => {
        expect(capturedBody).not.toBeNull();
      },
      { timeout: TEST_TIMEOUTS.FORM_SUBMIT },
    );

    expect(capturedBody).toMatchObject({
      name: "Alice Updated",
      color: "coral",
      avatarUrl: "https://example.com/avatar.jpg",
    });
  });

  it("shows the birthday with a countdown and saves a new one without a year", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-25T19:00:00Z")); // noon in Los Angeles
    try {
      seedFamilyStore({
        name: "Test Family",
        members: testMembers,
        timezone: "America/Los_Angeles",
      });
      let capturedBody: UpdateMemberRequest | null = null;
      const { server } = await import("@/test/mocks/server");
      server.use(
        http.put(`${API_BASE}/family/members/:id`, async ({ request }) => {
          capturedBody = (await request.json()) as UpdateMemberRequest;
          return HttpResponse.json({
            data: { ...testMember, ...capturedBody },
            message: "Member updated",
          });
        }),
      );

      const { user } = renderWithUser(
        <MemberProfileModal
          open={true}
          onOpenChange={vi.fn()}
          memberId="member-1"
        />,
      );

      expect(screen.getByLabelText("Birthday month")).toHaveValue("11");
      expect(screen.getByLabelText("Birthday day")).toHaveValue("3");
      expect(screen.getByLabelText(/birth year/i)).toHaveValue("2016");
      expect(screen.getByText("In 9 days · turns 10")).toBeInTheDocument();

      await user.selectOptions(screen.getByLabelText("Birthday month"), "2");
      await user.selectOptions(screen.getByLabelText("Birthday day"), "29");
      await user.clear(screen.getByLabelText(/birth year/i));
      await user.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => expect(capturedBody).not.toBeNull(), {
        timeout: TEST_TIMEOUTS.FORM_SUBMIT,
      });
      expect(capturedBody).toMatchObject({
        name: "Alice",
        birthday: { month: 2, day: 29, year: null },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses 29 February in a year that has none", async () => {
    seedFamily();
    const { user } = renderWithUser(
      <MemberProfileModal
        open={true}
        onOpenChange={vi.fn()}
        memberId="member-1"
      />,
    );

    await user.selectOptions(screen.getByLabelText("Birthday month"), "2");
    await user.selectOptions(screen.getByLabelText("Birthday day"), "29");
    await user.clear(screen.getByLabelText(/birth year/i));
    await user.type(screen.getByLabelText(/birth year/i), "2023");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText(/February 29 does not exist in 2023/i),
    ).toBeInTheDocument();
  });

  it("changing the picture opens the picker in place and saves the choice with every field", async () => {
    seedFamily();
    let capturedBody: UpdateMemberRequest | null = null;

    const { server } = await import("@/test/mocks/server");
    server.use(
      http.put(`${API_BASE}/family/members/:id`, async ({ request }) => {
        capturedBody = (await request.json()) as UpdateMemberRequest;
        return HttpResponse.json({
          data: { ...testMember, ...capturedBody },
          message: "Member updated",
        });
      }),
    );

    const { user } = renderWithUser(
      <MemberProfileModal
        open={true}
        onOpenChange={vi.fn()}
        memberId="member-1"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Change picture" }));
    expect(
      screen.getByRole("heading", { name: "Choose a picture for Alice" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).not.toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Pictures" }));
    await user.click(screen.getByRole("button", { name: "Fox" }));

    await waitFor(
      () => {
        expect(capturedBody).not.toBeNull();
      },
      { timeout: TEST_TIMEOUTS.FORM_SUBMIT },
    );
    expect(capturedBody).toMatchObject({
      name: "Alice",
      color: "coral",
      avatarUrl: "builtin:fox",
      birthday: { month: 11, day: 3, year: 2016 },
    });
    // Back on the profile once it saved.
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeVisible());
  });

  it("going back from the picker keeps the profile as it was", async () => {
    seedFamily();
    const { user } = renderWithUser(
      <MemberProfileModal
        open={true}
        onOpenChange={vi.fn()}
        memberId="member-1"
      />,
    );
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Ally");

    await user.click(screen.getByRole("button", { name: "Change picture" }));
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByLabelText("Name")).toHaveValue("Ally");
  });

  it("avatar removal keeps the birthday", async () => {
    seedFamily();
    let capturedBody: UpdateMemberRequest | null = null;
    const { server } = await import("@/test/mocks/server");
    server.use(
      http.put(`${API_BASE}/family/members/:id`, async ({ request }) => {
        capturedBody = (await request.json()) as UpdateMemberRequest;
        return HttpResponse.json({
          data: { ...testMember, ...capturedBody },
          message: "Member updated",
        });
      }),
    );
    const { user } = renderWithUser(
      <MemberProfileModal
        open={true}
        onOpenChange={vi.fn()}
        memberId="member-1"
      />,
    );
    await user.click(screen.getByRole("button", { name: /remove picture/i }));
    await waitFor(() => expect(capturedBody).not.toBeNull());
    expect(capturedBody).toMatchObject({
      avatarUrl: null,
      birthday: { month: 11, day: 3, year: 2016 },
    });
  });

  it("avatar removal sends avatarUrl: null", async () => {
    seedFamily();
    let capturedBody: UpdateMemberRequest | null = null;

    const { server } = await import("@/test/mocks/server");
    server.use(
      http.put(`${API_BASE}/family/members/:id`, async ({ request }) => {
        capturedBody = (await request.json()) as UpdateMemberRequest;
        return HttpResponse.json({
          data: { ...testMember, avatarUrl: undefined },
          message: "Member updated",
        });
      }),
    );

    const { user } = renderWithUser(
      <MemberProfileModal
        open={true}
        onOpenChange={vi.fn()}
        memberId="member-1"
      />,
    );

    await user.click(screen.getByRole("button", { name: /remove picture/i }));

    await waitFor(
      () => {
        expect(capturedBody).not.toBeNull();
      },
      { timeout: TEST_TIMEOUTS.FORM_SUBMIT },
    );

    expect(capturedBody).toMatchObject({
      name: "Alice",
      color: "coral",
      avatarUrl: null,
    });
  });
});

describe("MemberProfileModal — responsive surface", () => {
  it("renders a centered dialog with an X close button on desktop", () => {
    mockIsMobile = false;
    seedFamily();
    render(
      <MemberProfileModal open onOpenChange={vi.fn()} memberId="member-1" />,
    );

    expect(
      screen.getByRole("dialog", { name: "Member Profile" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("renders the profile form in a bottom sheet with Cancel (no X) on mobile", () => {
    mockIsMobile = true;
    seedFamily();
    render(
      <MemberProfileModal open onOpenChange={vi.fn()} memberId="member-1" />,
    );

    expect(
      screen.getByRole("dialog", { name: "Member Profile" }),
    ).toBeInTheDocument();
    // The sheet supplies a Cancel affordance (the form footer also keeps its
    // own Cancel), and the in-content X close is desktop-only.
    expect(
      screen.getAllByRole("button", { name: "Cancel" }).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    // Form content (email field) still renders inside the sheet.
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    mockIsMobile = false;
  });
});

describe("MemberProfileModal unsaved changes", () => {
  it("warns before closing with unsaved edits, and Keep editing keeps them", async () => {
    seedFamily();
    const onOpenChange = vi.fn();
    const { user } = renderWithUser(
      <MemberProfileModal
        open
        onOpenChange={onOpenChange}
        memberId="member-1"
      />,
    );

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Ally");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("Name")).toHaveValue("Ally");

    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(
      await screen.findByRole("button", { name: "Discard changes" }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes straight away when nothing changed", async () => {
    seedFamily();
    const onOpenChange = vi.fn();
    const { user } = renderWithUser(
      <MemberProfileModal
        open
        onOpenChange={onOpenChange}
        memberId="member-1"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(
      screen.queryByRole("dialog", { name: "Discard unsaved changes?" }),
    ).not.toBeInTheDocument();
  });

  // Making someone a kid saves at once, which updates the saved member; that must
  // not wipe what was typed into the form above it and not yet saved.
  it("keeps a half-entered birthday when the member is made a kid", async () => {
    seedFamily();
    let savedBody: UpdateMemberRequest | null = null;
    const { server } = await import("@/test/mocks/server");
    server.use(
      http.put(`${API_BASE}/family/members/:id/role`, () =>
        HttpResponse.json({
          data: { ...testMembers[1], role: "KID", hasPin: false },
          message: "Role changed",
        }),
      ),
      http.put(`${API_BASE}/family/members/:id`, async ({ request }) => {
        savedBody = (await request.json()) as UpdateMemberRequest;
        return HttpResponse.json({
          data: { ...testMembers[1], role: "KID", ...savedBody },
          message: "Member updated",
        });
      }),
    );
    const { user } = renderWithUser(
      <MemberProfileModal open onOpenChange={vi.fn()} memberId="member-2" />,
    );

    await user.selectOptions(screen.getByLabelText("Birthday month"), "4");
    await user.selectOptions(screen.getByLabelText("Birthday day"), "17");
    await user.click(screen.getByRole("button", { name: "Kid" }));
    await user.type(
      screen.getByLabelText("Family sign-in password"),
      "family-pass",
    );
    await user.click(screen.getByRole("button", { name: "Make Bob a kid" }));

    await waitFor(
      () =>
        expect(screen.getByRole("button", { name: "Kid" })).toHaveAttribute(
          "aria-pressed",
          "true",
        ),
      { timeout: TEST_TIMEOUTS.FORM_SUBMIT },
    );
    expect(screen.getByLabelText("Birthday month")).toHaveValue("4");
    expect(screen.getByLabelText("Birthday day")).toHaveValue("17");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(savedBody).not.toBeNull(), {
      timeout: TEST_TIMEOUTS.FORM_SUBMIT,
    });
    expect(savedBody).toMatchObject({
      name: "Bob",
      birthday: { month: 4, day: 17, year: null },
    });
  });

  it("starts afresh when it shows another member", async () => {
    seedFamily();
    const { user, rerender } = renderWithUser(
      <MemberProfileModal open onOpenChange={vi.fn()} memberId="member-1" />,
    );
    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Ally");

    rerender(
      <MemberProfileModal open onOpenChange={vi.fn()} memberId="member-2" />,
    );

    await waitFor(() =>
      expect(screen.getByLabelText("Name")).toHaveValue("Bob"),
    );
  });

  it("keeps a half-typed name when a PIN is set", async () => {
    seedFamily();
    const { server } = await import("@/test/mocks/server");
    server.use(
      http.put(
        `${API_BASE}/family/members/:id/pin`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const { user } = renderWithUser(
      <MemberProfileModal open onOpenChange={vi.fn()} memberId="member-1" />,
    );

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Ally");
    await user.click(screen.getByRole("button", { name: "Set PIN" }));
    await user.type(screen.getByLabelText("New PIN"), "2468");
    await user.type(
      screen.getByLabelText("Family sign-in password"),
      "family-pass",
    );
    await user.click(screen.getByRole("button", { name: "Save PIN" }));

    expect(
      await screen.findByText("PIN set", undefined, {
        timeout: TEST_TIMEOUTS.FORM_SUBMIT,
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Ally");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
  });

  it("counts a half-entered PIN as unsaved", async () => {
    seedFamily();
    const onOpenChange = vi.fn();
    const { user } = renderWithUser(
      <MemberProfileModal
        open
        onOpenChange={onOpenChange}
        memberId="member-1"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Set PIN" }));
    await user.type(screen.getByLabelText("New PIN"), "24");
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(
      await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
