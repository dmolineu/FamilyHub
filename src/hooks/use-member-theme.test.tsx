import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FamilyMember, ThemePackDocument } from "@/lib/types";
import { useThemeStore } from "@/stores/theme-store";
import { resetMockThemePacks, seedMockThemePacks } from "@/test/mocks/handlers";
import { setupMswServer } from "@/test/mocks/server";
import { render, seedFamilyStore, waitFor } from "@/test/test-utils";
import { usePersonTheme, useShowMemberTheme } from "./use-member-theme";

setupMswServer();

const JEEP: ThemePackDocument = {
  version: 1,
  name: "Jeep (desert)",
  dark: false,
  tokens: { "--primary": "#b4532a" },
};
const MOM: FamilyMember = { id: "mom", name: "Mom", color: "coral" };
const MAYA: FamilyMember = {
  id: "maya",
  name: "Maya",
  color: "teal",
  theme: "pack:Jeep (desert)",
};
const ZEV: FamilyMember = {
  id: "zev",
  name: "Zev",
  color: "green",
  theme: "builtin:midnight",
};

let show: ReturnType<typeof useShowMemberTheme>;

function Harness() {
  show = useShowMemberTheme();
  usePersonTheme();
  return null;
}

beforeEach(() => {
  localStorage.clear();
  useThemeStore.setState({
    mode: "single",
    selection: { kind: "builtin", id: "default" },
    daySelection: { kind: "builtin", id: "default" },
    nightSelection: { kind: "builtin", id: "midnight" },
    daytime: true,
    appliedPacks: {},
    person: null,
  });
  resetMockThemePacks();
  seedMockThemePacks([JEEP]);
  seedFamilyStore({ members: [MOM, MAYA, ZEV] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useShowMemberTheme", () => {
  it("shows a member's pack on this screen, fetching it the first time", async () => {
    render(<Harness />);
    await act(() => show(MAYA));

    const state = useThemeStore.getState();
    expect(state.person).toMatchObject({
      memberId: "maya",
      selection: { kind: "pack", id: "pack-1" },
    });
    expect(state.appliedPacks["pack-1"]?.name).toBe("Jeep (desert)");
    expect(state.resolved.theme).toBe("pack");
  });

  it("shows a member's built-in look", async () => {
    render(<Harness />);
    await act(() => show(ZEV));

    expect(useThemeStore.getState().resolved.theme).toBe("midnight");
  });

  it("goes back to the screen's own look for someone without one", async () => {
    render(<Harness />);
    await act(() => show(ZEV));
    await act(() => show(MOM));

    expect(useThemeStore.getState().person).toBeNull();
    expect(useThemeStore.getState().resolved.theme).toBe("default");
  });
});

describe("usePersonTheme", () => {
  it("goes back to the screen's own look after the family's revert time untouched", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seedFamilyStore({ members: [MOM, MAYA, ZEV], themeRevertMinutes: 5 });
    render(<Harness />);
    await act(() => show(ZEV));

    act(() => vi.advanceTimersByTime(4 * 60_000));
    // A touch restarts the count.
    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    act(() => vi.advanceTimersByTime(4 * 60_000));
    expect(useThemeStore.getState().person?.memberId).toBe("zev");

    act(() => vi.advanceTimersByTime(1.5 * 60_000));
    expect(useThemeStore.getState().person).toBeNull();
    expect(useThemeStore.getState().resolved.theme).toBe("default");
  });

  it("keeps the look when the family says Never", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    seedFamilyStore({ members: [MOM, MAYA, ZEV], themeRevertMinutes: 0 });
    render(<Harness />);
    await act(() => show(ZEV));

    act(() => vi.advanceTimersByTime(2 * 60 * 60_000));
    expect(useThemeStore.getState().person?.memberId).toBe("zev");
  });

  it("reverts at once after a reload if the screen sat untouched too long", () => {
    seedFamilyStore({ members: [MOM, MAYA, ZEV], themeRevertMinutes: 5 });
    useThemeStore.getState().showPerson({
      memberId: "zev",
      selection: { kind: "builtin", id: "midnight" },
      lastActiveAt: Date.now() - 10 * 60_000,
    });

    render(<Harness />);

    expect(useThemeStore.getState().person).toBeNull();
  });

  it("follows a change to that person's theme, and their clearing it", async () => {
    render(<Harness />);
    await act(() => show(ZEV));

    seedFamilyStore({
      members: [MOM, MAYA, { ...ZEV, theme: "builtin:sunrise" }],
    });
    await waitFor(() =>
      expect(useThemeStore.getState().resolved.theme).toBe("sunrise"),
    );

    seedFamilyStore({ members: [MOM, MAYA, { ...ZEV, theme: null }] });
    await waitFor(() => expect(useThemeStore.getState().person).toBeNull());
  });
});
