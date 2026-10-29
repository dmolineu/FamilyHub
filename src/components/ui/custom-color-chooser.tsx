import * as SliderPrimitive from "@radix-ui/react-slider";
import { type KeyboardEvent, type PointerEvent, useId, useState } from "react";
import { hexToRgb, type Rgb, rgbToHex } from "@/lib/member-color";
import type { CustomColor } from "@/lib/types";
import { Input } from "./input";
import { Label } from "./label";

/** Hue 0-360, saturation and brightness ("value") 0-1. */
interface Hsv {
  h: number;
  s: number;
  v: number;
}

/** What is typed in each field, kept apart so a half-typed value is not overwritten. */
interface Drafts {
  r: string;
  g: string;
  b: string;
  hex: string;
}

const HUES =
  "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)";
const PAD_SHADES =
  "linear-gradient(to top, #000000, transparent), linear-gradient(to right, #ffffff, transparent)";
const CHANNELS = [
  ["r", "Red"],
  ["g", "Green"],
  ["b", "Blue"],
] as const;

function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  let h = 0;
  if (delta > 0) {
    if (max === red) h = 60 * (((green - blue) / delta) % 6);
    else if (max === green) h = 60 * ((blue - red) / delta + 2);
    else h = 60 * ((red - green) / delta + 4);
  }
  return { h: (h + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}

function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    return 255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  return { r: channel(5), g: channel(3), b: channel(1) };
}

function draftsFor(rgb: Rgb): Drafts {
  const hex = rgbToHex(rgb);
  const exact = hexToRgb(hex);
  return {
    r: String(exact.r),
    g: String(exact.g),
    b: String(exact.b),
    hex,
  };
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

interface CustomColorChooserProps {
  /** Where the chooser starts: the member's colour now, as `#rrggbb`. */
  initial: string;
  onChange: (color: CustomColor) => void;
  id?: string;
}

/**
 * Picks any colour: drag or tap on the pad for saturation and brightness and
 * along the rainbow bar for the hue, or type red, green and blue (0-255) or a hex
 * code. Every change is sent straight away so the member's circle shows it live.
 * Touch-first: the pad follows a finger, the bar is a 44 px target, and both also
 * answer the arrow keys.
 */
export function CustomColorChooser({
  initial,
  onChange,
  id,
}: CustomColorChooserProps) {
  const fieldId = useId();
  const [color, setColor] = useState(() => {
    const rgb = hexToRgb(initial);
    return { rgb, hsv: rgbToHsv(rgb) };
  });
  const [drafts, setDrafts] = useState(() => draftsFor(hexToRgb(initial)));
  const { hsv } = color;
  const hex = rgbToHex(color.rgb);
  const hueHex = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));

  const commit = (rgb: Rgb, nextHsv: Hsv, typing?: keyof Drafts) => {
    setColor({ rgb, hsv: nextHsv });
    setDrafts((previous) =>
      typing
        ? { ...draftsFor(rgb), [typing]: previous[typing] }
        : draftsFor(rgb),
    );
    onChange(rgbToHex(rgb));
  };
  const fromHsv = (next: Hsv) => commit(hsvToRgb(next), next);
  const fromRgb = (rgb: Rgb, typing: keyof Drafts) => {
    const next = rgbToHsv(rgb);
    // A grey or black has no hue of its own: keep the bar where it was.
    commit(
      rgb,
      next.s === 0 || next.v === 0 ? { ...next, h: hsv.h } : next,
      typing,
    );
  };

  const pickAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    fromHsv({
      h: hsv.h,
      s: clamp((event.clientX - box.left) / box.width),
      v: clamp(1 - (event.clientY - box.top) / box.height),
    });
  };

  const onPadKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: clamp(hsv.s - step) },
      ArrowRight: { s: clamp(hsv.s + step) },
      ArrowDown: { v: clamp(hsv.v - step) },
      ArrowUp: { v: clamp(hsv.v + step) },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    fromHsv({ ...hsv, ...move });
  };

  const onChannel = (channel: "r" | "g" | "b", text: string) => {
    setDrafts((previous) => ({ ...previous, [channel]: text }));
    if (!/^\d{1,3}$/.test(text) || Number(text) > 255) return;
    fromRgb({ ...color.rgb, [channel]: Number(text) }, channel);
  };

  const onHex = (text: string) => {
    setDrafts((previous) => ({ ...previous, hex: text }));
    const digits = text.trim().replace(/^#/, "");
    if (!/^[0-9a-f]{6}$/i.test(digits)) return;
    fromRgb(hexToRgb(`#${digits.toLowerCase()}`), "hex");
  };

  return (
    <div id={id} className="space-y-3 rounded-xl border border-border p-3">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.v * 100)}
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        className="relative h-40 w-full cursor-crosshair touch-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={{ backgroundColor: hueHex, backgroundImage: PAD_SHADES }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pickAt(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            pickAt(event);
          }
        }}
        onKeyDown={onPadKey}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/30"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            backgroundColor: hex,
          }}
        />
      </div>

      <SliderPrimitive.Root
        value={[Math.round(hsv.h)]}
        min={0}
        max={359}
        step={1}
        onValueChange={([h]) => fromHsv({ ...hsv, h })}
        className="relative flex h-11 w-full touch-none select-none items-center"
      >
        <SliderPrimitive.Track
          className="relative h-4 w-full grow rounded-full"
          style={{ backgroundImage: HUES }}
        />
        <SliderPrimitive.Thumb
          aria-label="Hue"
          className="block h-7 w-7 rounded-full border-2 border-white shadow-md ring-1 ring-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ backgroundColor: hueHex }}
        />
      </SliderPrimitive.Root>

      <div className="grid grid-cols-[1fr_1fr_1fr_1.7fr] gap-2">
        {CHANNELS.map(([channel, label]) => (
          <div key={channel} className="space-y-1">
            <Label htmlFor={`${fieldId}-${channel}`} className="text-xs">
              {label}
            </Label>
            <Input
              id={`${fieldId}-${channel}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={255}
              value={drafts[channel]}
              onChange={(event) => onChannel(channel, event.target.value)}
              className="px-2"
            />
          </div>
        ))}
        <div className="space-y-1">
          <Label htmlFor={`${fieldId}-hex`} className="text-xs">
            Hex
          </Label>
          <Input
            id={`${fieldId}-hex`}
            value={drafts.hex}
            onChange={(event) => onHex(event.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={7}
            className="px-2"
          />
        </div>
      </div>
    </div>
  );
}
