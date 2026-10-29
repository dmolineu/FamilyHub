import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FamilyMember } from "@/lib/types";
import { setupMswServer } from "@/test/mocks/server";
import {
  render,
  renderWithUser,
  screen,
  seedFamilyStore,
  within,
} from "@/test/test-utils";
import { SettingsSheet } from "./settings-sheet";

// The responsive wrapper switches on useIsMobile; default to desktop so the
// assertions exercise the centered dialog.
vi.mock("@/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks")>();
  return { ...actual, useIsMobile: () => false };
});

setupMswServer();

const ALICE: FamilyMember = { id: "member-1", name: "Alice", color: "coral" };

const noop = () => {};

const TABS = [
  "Family",
  "This screen",
  "Weather & Sports",
  "Photos",
  "Accounts",
  "Backup",
];

beforeEach(() => {
  seedFamilyStore({ name: "Test Family", members: [ALICE] });
});

describe("SettingsSheet", () => {
  it("is one Settings screen with six tabs, opening on Family", () => {
    render(<SettingsSheet open onOpenChange={noop} />);

    expect(
      screen.getByRole("dialog", { name: "Settings" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("tab").map((tab) => tab.textContent?.trim()),
    ).toEqual(TABS);
    expect(screen.getByRole("tab", { name: "Family" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it.each([
    [
      "Family",
      ["Family Name", "Family Timezone", "Family Members", "Character packs"],
    ],
    ["This screen", ["Display", "Screensaver", "Appearance"]],
    ["Weather & Sports", ["Weather", "Teams"]],
    ["Photos", ["Photo storage", "Photos from a folder"]],
    ["Accounts", ["Family inbox", "Sign-in password", "Coming Soon"]],
    ["Backup", ["Backup", "Reset this family"]],
  ])("keeps the %s tab's sections together", async (tab, headings) => {
    const { user } = renderWithUser(<SettingsSheet open onOpenChange={noop} />);

    await user.click(screen.getByRole("tab", { name: tab }));

    // Only the chosen tab's panel shows.
    const panels = screen.getAllByRole("tabpanel");
    expect(panels).toHaveLength(1);
    const panel = screen.getByRole("tabpanel", { name: tab });
    for (const heading of headings) {
      expect(
        await within(panel).findByRole("heading", { name: heading }),
      ).toBeInTheDocument();
    }
  });

  it("asks for a parent's PIN once for every tab", async () => {
    seedFamilyStore({
      name: "Test Family",
      members: [{ ...ALICE, role: "PARENT", hasPin: true }],
    });
    const { user } = renderWithUser(<SettingsSheet open onOpenChange={noop} />);

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Alice", exact: true }),
    );
    for (const digit of "2468") {
      await user.click(
        screen.getByRole("button", { name: digit, exact: true }),
      );
    }

    await user.click(await screen.findByRole("tab", { name: "This screen" }));
    expect(
      screen.getByRole("heading", { name: "Display" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Backup" }));
    expect(
      screen.getByRole("button", { name: "Download backup" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unlock" })).toBeNull();
  });

  it("keeps a half-typed weather location across tabs and asks before closing", async () => {
    const onOpenChange = vi.fn();
    const { user } = renderWithUser(
      <SettingsSheet open onOpenChange={onOpenChange} />,
    );

    await user.click(screen.getByRole("tab", { name: "Weather & Sports" }));
    await user.type(screen.getByLabelText("Weather location"), "San Diego");
    await user.click(screen.getByRole("tab", { name: "Family" }));
    await user.click(screen.getByRole("tab", { name: "Weather & Sports" }));
    expect(screen.getByLabelText("Weather location")).toHaveValue("San Diego");

    await user.click(screen.getByRole("tab", { name: "Backup" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(
      await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("moves between tabs with the arrow keys", async () => {
    const { user } = renderWithUser(<SettingsSheet open onOpenChange={noop} />);

    await user.click(screen.getByRole("tab", { name: "Family" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "This screen" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "This screen" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Backup" })).toHaveFocus();
  });

  it("opens on Family again the next time", async () => {
    const { user, rerender } = renderWithUser(
      <SettingsSheet open onOpenChange={noop} />,
    );
    await user.click(screen.getByRole("tab", { name: "Backup" }));

    rerender(<SettingsSheet open={false} onOpenChange={noop} />);
    rerender(<SettingsSheet open onOpenChange={noop} />);

    expect(await screen.findByRole("tab", { name: "Family" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
