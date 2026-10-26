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

  it("avatar upload sends all fields including base64 avatarUrl", async () => {
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

    render(
      <MemberProfileModal
        open={true}
        onOpenChange={vi.fn()}
        memberId="member-1"
      />,
    );

    const fileInput = screen.getByLabelText("Upload avatar image");
    const file = new File(["fake-image-content"], "photo.png", {
      type: "image/png",
    });

    // Simulate upload via fireEvent (userEvent.upload can be flaky with hidden inputs)
    Object.defineProperty(fileInput, "files", { value: [file] });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

    await waitFor(
      () => {
        expect(capturedBody).not.toBeNull();
      },
      { timeout: TEST_TIMEOUTS.FORM_SUBMIT },
    );

    expect(capturedBody!.name).toBe("Alice");
    expect(capturedBody!.color).toBe("coral");
    expect(capturedBody!.avatarUrl).toMatch(/^data:image\/png;base64,/);
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
    await user.click(screen.getByRole("button", { name: /remove photo/i }));
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

    await user.click(screen.getByRole("button", { name: /remove photo/i }));

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

  it("shows error for invalid file type", async () => {
    seedFamily();

    render(
      <MemberProfileModal
        open={true}
        onOpenChange={vi.fn()}
        memberId="member-1"
      />,
    );

    const fileInput = screen.getByLabelText("Upload avatar image");
    const file = new File(["not-an-image"], "readme.txt", {
      type: "text/plain",
    });

    Object.defineProperty(fileInput, "files", { value: [file] });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

    expect(
      await screen.findByText("Please select an image file"),
    ).toBeInTheDocument();
  });

  it("shows error for oversized file", async () => {
    seedFamily();

    render(
      <MemberProfileModal
        open={true}
        onOpenChange={vi.fn()}
        memberId="member-1"
      />,
    );

    const fileInput = screen.getByLabelText("Upload avatar image");
    // Create a file larger than 500KB
    const bigContent = new Uint8Array(501 * 1024);
    const file = new File([bigContent], "big-photo.png", {
      type: "image/png",
    });

    Object.defineProperty(fileInput, "files", { value: [file] });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

    expect(
      await screen.findByText("Image must be smaller than 500KB"),
    ).toBeInTheDocument();
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
