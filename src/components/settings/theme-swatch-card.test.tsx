import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeSwatchCard } from "./theme-swatch-card";

const PNG_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("ThemeSwatchCard", () => {
  it("draws a miniature of the app in the look's own colours", () => {
    render(
      <ThemeSwatchCard
        name="Padres (night)"
        dark
        preview={{
          background: "#2f241d",
          card: "#3b2e25",
          primary: "#ffc425",
          foreground: "#f7f1e8",
          accent: "#5a4838",
          thumbnail: null,
        }}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    const mini = screen.getByTestId("theme-preview");
    expect(mini.style.backgroundColor).toBe("rgb(47, 36, 29)");
    expect(screen.getByTestId("theme-preview-card").style.backgroundColor).toBe(
      "rgb(59, 46, 37)",
    );
    expect(
      screen.getByTestId("theme-preview-primary").style.backgroundColor,
    ).toBe("rgb(255, 196, 37)");
    expect(screen.getByTestId("theme-preview-text").style.backgroundColor).toBe(
      "rgb(247, 241, 232)",
    );
  });

  it("paints the pack's thumbnail behind the miniature when it has one", () => {
    render(
      <ThemeSwatchCard
        name="Pokémon (night)"
        dark
        preview={{
          background: "#121a4d",
          card: "#1b2457",
          primary: "#ffcb05",
          foreground: "#f3f4ff",
          accent: null,
          thumbnail: PNG_PIXEL,
        }}
        selected
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("theme-preview").style.backgroundImage).toContain(
      PNG_PIXEL,
    );
    expect(
      screen.getByRole("radio", { name: "Pokémon (night)" }),
    ).toBeChecked();
  });

  it("falls back to neutral colours for anything the look does not define", () => {
    render(
      <ThemeSwatchCard
        name="Mystery"
        dark={false}
        preview={{
          background: null,
          card: null,
          primary: "#e3350d",
          foreground: null,
          accent: null,
          thumbnail: null,
        }}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    const mini = screen.getByTestId("theme-preview");
    expect(mini.style.backgroundColor).not.toBe("");
    expect(
      screen.getByTestId("theme-preview-primary").style.backgroundColor,
    ).toBe("rgb(227, 53, 13)");
  });
});
