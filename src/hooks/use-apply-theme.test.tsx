import { QueryClient } from "@tanstack/react-query";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type FamilyApiResponse, familyKeys } from "@/api";
import type { FamilyData } from "@/lib/types";
import { useThemeStore } from "@/stores/theme-store";
import { render } from "@/test/test-utils";
import { useApplyTheme } from "./use-apply-theme";

function Probe() {
  useApplyTheme();
  return null;
}

const SAN_DIEGO_FAMILY: FamilyData = {
  id: "family-1",
  name: "Sun Family",
  timezone: "America/Los_Angeles",
  latitude: 32.7157,
  longitude: -117.1647,
  members: [{ id: "member-1", name: "Alice", color: "coral" }],
  createdAt: "2025-01-01T00:00:00.000Z",
};

function clientWith(family: FamilyData | null): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
  if (family) {
    client.setQueryData<FamilyApiResponse>(familyKeys.family(), {
      data: family,
    });
  }
  return client;
}

const html = () => document.documentElement;

beforeEach(() => {
  html().removeAttribute("data-theme");
  html().classList.remove("dark");
  useThemeStore.setState({
    mode: "single",
    selection: { kind: "builtin", id: "default" },
    daySelection: { kind: "builtin", id: "default" },
    nightSelection: { kind: "builtin", id: "midnight" },
    daytime: true,
    appliedPacks: {},
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useApplyTheme", () => {
  it("applies the stored look on mount and follows later changes", () => {
    useThemeStore.getState().setSelection({ kind: "builtin", id: "midnight" });
    render(<Probe />, { queryClient: clientWith(null) });
    expect(html().dataset.theme).toBe("midnight");
    expect(html().classList.contains("dark")).toBe(true);

    act(() => {
      useThemeStore.getState().setSelection({ kind: "builtin", id: "sunrise" });
    });
    expect(html().dataset.theme).toBe("sunrise");
    expect(html().classList.contains("dark")).toBe(false);
  });

  it("in sun mode shows the daytime look by day and flips at sunset using the family's spot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T19:00:00Z")); // noon in San Diego
    useThemeStore.setState({
      mode: "sun",
      daySelection: { kind: "builtin", id: "sunrise" },
      nightSelection: { kind: "builtin", id: "midnight" },
      daytime: false, // stale from last night; the applier must re-evaluate
    });

    render(<Probe />, { queryClient: clientWith(SAN_DIEGO_FAMILY) });
    expect(useThemeStore.getState().daytime).toBe(true);
    expect(html().dataset.theme).toBe("sunrise");

    // Sunset is 19:59 PDT (02:59Z). Nine hours on, it is night.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9 * 60 * 60 * 1000);
    });
    expect(useThemeStore.getState().daytime).toBe(false);
    expect(html().dataset.theme).toBe("midnight");
    expect(html().classList.contains("dark")).toBe(true);
  });

  it("in single mode leaves the daytime flag alone", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T19:00:00Z"));
    useThemeStore.setState({ daytime: false });
    render(<Probe />, { queryClient: clientWith(SAN_DIEGO_FAMILY) });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    });
    expect(useThemeStore.getState().daytime).toBe(false);
  });
});
