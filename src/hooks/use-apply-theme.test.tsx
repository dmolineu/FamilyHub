import { render } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "@/stores/theme-store";
import { useApplyTheme } from "./use-apply-theme";

function Probe() {
  useApplyTheme();
  return null;
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark");
  useThemeStore.setState({
    selection: { kind: "builtin", id: "default" },
    appliedPack: null,
  });
});

describe("useApplyTheme", () => {
  it("applies the stored look on mount and follows later changes", () => {
    useThemeStore.getState().setSelection({ kind: "builtin", id: "midnight" });
    render(<Probe />);
    expect(document.documentElement.dataset.theme).toBe("midnight");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      useThemeStore.getState().setSelection({ kind: "builtin", id: "sunrise" });
    });
    expect(document.documentElement.dataset.theme).toBe("sunrise");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
