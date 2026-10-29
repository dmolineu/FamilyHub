import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithUser, screen } from "@/test/test-utils";
import { ColorPicker } from "./color-picker";

describe("ColorPicker", () => {
  // Radix's slider measures itself; the global stub in src/test/setup.ts is not constructable.
  beforeEach(() => {
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  it("offers the seven colours and a custom one", () => {
    renderWithUser(<ColorPicker value="coral" onChange={vi.fn()} />);

    expect(
      screen.getAllByRole("button", { name: /^Select \w+ color$/ }),
    ).toHaveLength(7);
    expect(
      screen.getByRole("button", { name: "Choose a custom color" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("still picks a named colour", async () => {
    const onChange = vi.fn();
    const { user } = renderWithUser(
      <ColorPicker value="coral" onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Select teal color" }));

    expect(onChange).toHaveBeenCalledWith("teal");
  });

  it("opens a chooser where any colour can be typed as red, green and blue", async () => {
    const onChange = vi.fn();
    const { user } = renderWithUser(
      <ColorPicker value="coral" onChange={onChange} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Choose a custom color" }),
    );
    for (const [channel, value] of [
      ["Red", "74"],
      ["Green", "144"],
      ["Blue", "217"],
    ]) {
      const field = screen.getByRole("spinbutton", { name: channel });
      await user.clear(field);
      await user.type(field, value);
    }

    expect(onChange).toHaveBeenLastCalledWith("#4a90d9");
  });

  it("takes a hex code too", async () => {
    const onChange = vi.fn();
    const { user } = renderWithUser(
      <ColorPicker value="coral" onChange={onChange} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Choose a custom color" }),
    );
    const hex = screen.getByRole("textbox", { name: "Hex" });
    await user.clear(hex);
    await user.type(hex, "#FF8800");

    expect(onChange).toHaveBeenLastCalledWith("#ff8800");
  });

  it("starts the chooser on the current custom colour and marks it chosen", async () => {
    const { user } = renderWithUser(
      <ColorPicker value="#4a90d9" onChange={vi.fn()} />,
    );
    const custom = screen.getByRole("button", {
      name: "Choose a custom color",
    });
    expect(custom).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Select coral color" }),
    ).toHaveAttribute("aria-pressed", "false");

    await user.click(custom);

    expect(screen.getByRole("spinbutton", { name: "Red" })).toHaveValue(74);
    expect(screen.getByRole("spinbutton", { name: "Green" })).toHaveValue(144);
    expect(screen.getByRole("spinbutton", { name: "Blue" })).toHaveValue(217);
  });

  it("moves through colours from the keyboard on the colour pad and the hue bar", async () => {
    const onChange = vi.fn();
    const { user } = renderWithUser(
      <ColorPicker value="#4a90d9" onChange={onChange} />,
    );
    await user.click(
      screen.getByRole("button", { name: "Choose a custom color" }),
    );

    screen.getByRole("slider", { name: "Saturation and brightness" }).focus();
    await user.keyboard("{ArrowUp}");
    const afterPad = onChange.mock.lastCall?.[0];
    expect(afterPad).toMatch(/^#[0-9a-f]{6}$/);
    expect(afterPad).not.toBe("#4a90d9");

    screen.getByRole("slider", { name: "Hue" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange.mock.lastCall?.[0]).not.toBe(afterPad);
  });
});
