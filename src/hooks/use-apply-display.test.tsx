import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useDisplayStore } from "@/stores/display-store";
import { useApplyDisplay } from "./use-apply-display";

describe("useApplyDisplay", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
    useDisplayStore.setState({ mode: "standard" });
    document.documentElement.removeAttribute("data-display");
  });

  it("takes ?display=wall from a kiosk's address and keeps it for the device", () => {
    window.history.replaceState(null, "", "/?display=wall");
    renderHook(() => useApplyDisplay());
    expect(useDisplayStore.getState().mode).toBe("wall");
    expect(document.documentElement.getAttribute("data-display")).toBe("wall");
  });

  it("follows the device's choice made in Settings", () => {
    const { rerender } = renderHook(() => useApplyDisplay());
    expect(document.documentElement.hasAttribute("data-display")).toBe(false);
    useDisplayStore.setState({ mode: "wall" });
    rerender();
    expect(document.documentElement.getAttribute("data-display")).toBe("wall");
  });
});
