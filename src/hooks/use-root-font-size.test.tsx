import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useRootFontSize } from "./use-root-font-size";

describe("useRootFontSize", () => {
  afterEach(() => {
    document.documentElement.style.fontSize = "";
  });

  it("reads the page's base text size in pixels", () => {
    document.documentElement.style.fontSize = "22px";
    const { result } = renderHook(() => useRootFontSize());
    expect(result.current).toBe(22);
  });

  it("follows it when the window is resized", () => {
    document.documentElement.style.fontSize = "22px";
    const { result } = renderHook(() => useRootFontSize());

    act(() => {
      document.documentElement.style.fontSize = "29px";
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(29);
  });

  it("assumes the browser default when nothing is set", () => {
    const { result } = renderHook(() => useRootFontSize());
    expect(result.current).toBe(16);
  });
});
