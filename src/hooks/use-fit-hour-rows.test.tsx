import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useFitHourRows } from "./use-fit-hour-rows";

function container(height: number) {
  const element = document.createElement("div");
  Object.defineProperty(element, "clientHeight", { value: height });
  return { current: element };
}

describe("useFitHourRows", () => {
  it("keeps the usual row height unless the device is a wall", () => {
    const { result } = renderHook(() =>
      useFitHourRows(container(1800), 52, 18, false),
    );
    expect(result.current).toBe(52);
  });

  it("on a wall, stretches the rows so the whole day fits without scrolling", () => {
    const { result } = renderHook(() =>
      useFitHourRows(container(900), 52, 18, true),
    );
    expect(result.current).toBe(50);
  });

  it("never squeezes rows below a tappable minimum", () => {
    const { result } = renderHook(() =>
      useFitHourRows(container(300), 52, 18, true),
    );
    expect(result.current).toBe(36);
  });
});
