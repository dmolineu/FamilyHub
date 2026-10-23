import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "@/stores/theme-store";
import {
  ThemeBackground,
  ThemeHeaderLogo,
  ThemeHomeBanner,
  ThemeMascots,
} from "./theme-decor";

const PNG_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function selectPack(
  slots: {
    headerLogo?: string;
    homeBanner?: string;
    mascots?: string[];
  },
  images: Record<string, string> = {
    logo: PNG_PIXEL,
    petco: PNG_PIXEL,
    pikachu: PNG_PIXEL,
  },
) {
  useThemeStore.getState().setAppliedPack({
    id: "p1",
    name: "Padres",
    dark: true,
    tokens: {},
    images,
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

  it("show up to six mascots in the order the pack lists them", () => {
    const images: Record<string, string> = {};
    for (let i = 1; i <= 7; i += 1) images[`m${i}`] = PNG_PIXEL;
    selectPack({ mascots: Object.keys(images) }, images);
    render(<ThemeMascots />);
    expect(
      screen.getByTestId("theme-mascots").querySelectorAll("img"),
    ).toHaveLength(6);
  });

  it("paint a full-screen backdrop only when the pack has a background image", () => {
    const { unmount } = render(<ThemeBackground />);
    expect(screen.queryByTestId("theme-background")).not.toBeInTheDocument();
    unmount();

    selectPack({}, { background: PNG_PIXEL });
    render(<ThemeBackground />);
    const backdrop = screen.getByTestId("theme-background");
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop.style.backgroundImage).toContain(PNG_PIXEL);
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
