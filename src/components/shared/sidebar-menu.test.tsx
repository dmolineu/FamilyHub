import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/stores";
import { useThemeStore } from "@/stores/theme-store";
import { setupMswServer } from "@/test/mocks/server";
import {
  renderWithUser,
  screen,
  seedFamilyStore,
  waitFor,
  within,
} from "@/test/test-utils";
import { SidebarMenu } from "./sidebar-menu";

// The profile's PIN is checked by the (mock) server.
setupMswServer();

const logoutSpy = vi.fn();
vi.mock("@/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api")>();
  return { ...actual, useLogout: () => logoutSpy };
});

describe("SidebarMenu", () => {
  beforeEach(() => {
    logoutSpy.mockClear();
    seedFamilyStore({
      name: "Test Family",
      members: [{ id: "m1", name: "Alice", color: "coral" }],
    });
    useAppStore.setState({ isSidebarOpen: true });
  });

  it("closes on Escape", async () => {
    const { user } = renderWithUser(<SidebarMenu />);
    expect(screen.getByText("Test Family")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(useAppStore.getState().isSidebarOpen).toBe(false);
  });

  it("shows each member's chosen picture", () => {
    seedFamilyStore({
      name: "Test Family",
      members: [
        { id: "m1", name: "Alice", color: "coral", avatarUrl: "builtin:fox" },
      ],
    });
    const { container } = renderWithUser(<SidebarMenu />);
    expect(
      container.ownerDocument.querySelector('svg[data-avatar-key="fox"]'),
    ).not.toBeNull();
  });

  it("orders menu rows: Settings, Install app, Sign Out", () => {
    renderWithUser(<SidebarMenu />);

    const nav = screen.getByRole("navigation");
    const labels = within(nav)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim());
    expect(labels).toEqual(["Settings", "Install app", "Sign Out"]);
  });

  it("opens the one Settings screen from the Settings row", async () => {
    const { user } = renderWithUser(<SidebarMenu />);

    await user.click(screen.getByRole("button", { name: "Settings" }));

    // The sheet is code-split, so it appears once its chunk has loaded.
    expect(
      await screen.findByRole("dialog", { name: "Settings" }),
    ).toBeInTheDocument();
  });

  it("requires confirmation before signing out", async () => {
    const { user } = renderWithUser(<SidebarMenu />);
    await user.click(screen.getByRole("button", { name: /sign out/i }));
    expect(logoutSpy).not.toHaveBeenCalled();

    // confirmation dialog appears
    await user.click(
      screen.getByRole("button", { name: /^sign out$/i, hidden: false }),
    );
    expect(logoutSpy).toHaveBeenCalledTimes(1);
  });
});

describe("SidebarMenu personal themes", () => {
  beforeEach(() => {
    useThemeStore.setState({
      mode: "single",
      selection: { kind: "builtin", id: "default" },
      appliedPacks: {},
      person: null,
    });
    useAppStore.setState({ isSidebarOpen: true });
  });

  it("shows a kid's own theme when their name is tapped", async () => {
    seedFamilyStore({
      name: "Test Family",
      members: [
        {
          id: "mom",
          name: "Mom",
          color: "coral",
          role: "PARENT",
          hasPin: true,
        },
        {
          id: "maya",
          name: "Maya",
          color: "teal",
          role: "KID",
          theme: "builtin:midnight",
        },
      ],
    });
    const { user } = renderWithUser(<SidebarMenu />);

    await user.click(screen.getByRole("button", { name: /Maya/ }));

    await waitFor(() =>
      expect(useThemeStore.getState().person?.memberId).toBe("maya"),
    );
  });

  it("shows a parent's own theme only once their PIN opens the profile", async () => {
    seedFamilyStore({
      name: "Test Family",
      members: [
        {
          id: "mom",
          name: "Mom",
          color: "coral",
          role: "PARENT",
          hasPin: true,
          theme: "builtin:sunrise",
        },
      ],
    });
    const { user } = renderWithUser(<SidebarMenu />);

    await user.click(screen.getByRole("button", { name: /Mom/ }));
    expect(await screen.findByLabelText("Mom's PIN")).toBeInTheDocument();
    expect(useThemeStore.getState().person).toBeNull();

    for (const digit of "2468") {
      await user.click(
        screen.getByRole("button", { name: digit, exact: true }),
      );
    }

    await waitFor(() =>
      expect(useThemeStore.getState().resolved.theme).toBe("sunrise"),
    );
  });
});
