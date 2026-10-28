import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNow } from "./use-now";

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 27, 10, 0, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves on at each minute boundary, not a minute after mounting", () => {
    const { result } = renderHook(() => useNow());
    expect(result.current.getMinutes()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(result.current.getMinutes()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.getMinutes()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.getMinutes()).toBe(2);
  });

  it("stops ticking once unmounted", () => {
    const { unmount } = renderHook(() => useNow());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
