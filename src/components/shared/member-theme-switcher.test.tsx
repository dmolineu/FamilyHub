import { beforeEach, describe, expect, it } from "vitest";
import type { FamilyMember } from "@/lib/types";
import { useThemeStore } from "@/stores/theme-store";
import { setupMswServer } from "@/test/mocks/server";
import {
  renderWithUser,
  screen,
  seedFamilyStore,
  waitFor,
} from "@/test/test-utils";
import { MemberThemeSwitcher } from "./member-theme-switcher";

setupMswServer();

const MOM: FamilyMember = { id: "mom", name: "Mom", color: "coral" };
const MAYA: FamilyMember = {
  id: "maya",
  name: "Maya",
  color: "teal",
  avatarUrl: "builtin:fox",
  theme: "builtin:midnight",
};

describe("MemberThemeSwitcher", () => {
  beforeEach(() => {
    localStorage.clear();
    useThemeStore.setState({
      mode: "single",
      selection: { kind: "builtin", id: "default" },
      appliedPacks: {},
      person: null,
    });
    seedFamilyStore({ members: [MOM, MAYA] });
  });

  it("offers each member's picture, big enough to tap", () => {
    renderWithUser(<MemberThemeSwitcher />);

    const maya = screen.getByRole("button", { name: "Show Maya's theme" });
    expect(maya.querySelector('svg[data-avatar-key="fox"]')).not.toBeNull();
    expect(maya).toHaveClass("h-11", "w-11");
    expect(
      screen.getByRole("button", { name: "Show Mom's theme" }),
    ).toBeInTheDocument();
  });

  it("shows the tapped member's theme on this screen and marks them", async () => {
    const { user } = renderWithUser(<MemberThemeSwitcher />);

    await user.click(screen.getByRole("button", { name: "Show Maya's theme" }));

    await waitFor(() =>
      expect(useThemeStore.getState().resolved.theme).toBe("midnight"),
    );
    expect(
      screen.getByRole("button", { name: "Show Maya's theme" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Show Mom's theme" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("goes back to the screen's own look for someone without a theme", async () => {
    const { user } = renderWithUser(<MemberThemeSwitcher />);
    await user.click(screen.getByRole("button", { name: "Show Maya's theme" }));
    await waitFor(() =>
      expect(useThemeStore.getState().person?.memberId).toBe("maya"),
    );

    await user.click(screen.getByRole("button", { name: "Show Mom's theme" }));

    await waitFor(() => expect(useThemeStore.getState().person).toBeNull());
    expect(useThemeStore.getState().resolved.theme).toBe("default");
  });
});
