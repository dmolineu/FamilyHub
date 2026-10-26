import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScreensaverStore } from "@/stores";
import {
  resolveScreensaverMs,
  useScreensaverIdle,
} from "./use-screensaver-idle";

const viewport = vi.hoisted(() => ({ isLargeScreen: true }));
vi.mock("./use-is-large-screen", () => ({
  useIsLargeScreen: () => viewport.isLargeScreen,
}));

describe("resolveScreensaverMs", () => {
  it("is 10 minutes on a wall and off elsewhere when automatic", () => {
    expect(resolveScreensaverMs("auto", true)).toBe(10 * 60 * 1000);
    expect(resolveScreensaverMs("auto", false)).toBeNull();
  });

  it("follows an explicit choice on any screen", () => {
    expect(resolveScreensaverMs(5, false)).toBe(5 * 60 * 1000);
    expect(resolveScreensaverMs("off", true)).toBeNull();
  });
});

describe("useScreensaverIdle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    viewport.isLargeScreen = true;
    useScreensaverStore.setState({ delay: 1, isActive: false });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts the screensaver after the chosen idle time", () => {
    renderHook(() => useScreensaverIdle(true));

    act(() => vi.advanceTimersByTime(59_000));
    expect(useScreensaverStore.getState().isActive).toBe(false);
    act(() => vi.advanceTimersByTime(1_000));
    expect(useScreensaverStore.getState().isActive).toBe(true);
  });

  it("starts counting again whenever someone touches the screen", () => {
    renderHook(() => useScreensaverIdle(true));

    act(() => vi.advanceTimersByTime(50_000));
    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    act(() => vi.advanceTimersByTime(50_000));
    expect(useScreensaverStore.getState().isActive).toBe(false);
    act(() => vi.advanceTimersByTime(10_000));
    expect(useScreensaverStore.getState().isActive).toBe(true);
  });

  it("never starts when switched off or before sign-in", () => {
    useScreensaverStore.setState({ delay: "off" });
    const { rerender } = renderHook(({ on }) => useScreensaverIdle(on), {
      initialProps: { on: true },
    });
    act(() => vi.advanceTimersByTime(2 * 60 * 60 * 1000));
    expect(useScreensaverStore.getState().isActive).toBe(false);

    useScreensaverStore.setState({ delay: 1 });
    rerender({ on: false });
    act(() => vi.advanceTimersByTime(2 * 60 * 60 * 1000));
    expect(useScreensaverStore.getState().isActive).toBe(false);
  });
});
