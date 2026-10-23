import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "@/stores/theme-store";
import { ThemeHeaderLogo, ThemeHomeBanner, ThemeMascots } from "./theme-decor";

const PNG_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function selectPack(slots: {
  headerLogo?: string;
  homeBanner?: string;
  mascots?: string[];
}) {
  useThemeStore.getState().setAppliedPack({
    id: "p1",
    name: "Padres",
    dark: true,
    tokens: {},
    images: { logo: PNG_PIXEL, petco: PNG_PIXEL, pikachu: PNG_PIXEL },
    slots,
  });
  useThemeStore.getState().setSelection({ kind: "pack", id: "p1" });
}

beforeEach(() => {
  useThemeStore.setState({
    selection: { kind: "builtin", id: "default" },
    appliedPack: null,
  });
});

describe("theme decoration slots", () => {
  it("render nothing for a built-in look", () => {
    render(
      <>
        <ThemeHeaderLogo />
        <ThemeHomeBanner />
        <ThemeMascots />
      </>,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByTestId("theme-mascots")).not.toBeInTheDocument();
  });

  it("show the pack's header logo, home banner and mascots from its image slots", () => {
    selectPack({
      headerLogo: "logo",
      homeBanner: "petco",
      mascots: ["pikachu", "missing-key"],
    });
    render(
      <>
        <ThemeHeaderLogo />
        <ThemeHomeBanner />
        <ThemeMascots />
      </>,
    );
    const logo = screen.getByRole("img", { name: "Padres" });
    expect(logo).toHaveAttribute("src", PNG_PIXEL);
    expect(screen.getByTestId("theme-home-banner")).toHaveAttribute(
      "src",
      PNG_PIXEL,
    );
    // Decorative mascots are hidden from assistive tech; an unknown key is skipped.
    const mascots = screen.getByTestId("theme-mascots");
    expect(mascots).toHaveAttribute("aria-hidden", "true");
    expect(mascots.querySelectorAll("img")).toHaveLength(1);
  });

  it("render nothing for slots the pack does not fill", () => {
    selectPack({ headerLogo: "logo" });
    render(
      <>
        <ThemeHomeBanner />
        <ThemeMascots />
      </>,
    );
    expect(screen.queryByTestId("theme-home-banner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("theme-mascots")).not.toBeInTheDocument();
  });
});
