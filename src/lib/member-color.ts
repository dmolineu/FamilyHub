import {
  type CustomColor,
  colorMap,
  type FamilyColor,
  type MemberColorStyle,
  type PaletteColor,
} from "@/lib/types";

const CUSTOM = /^#[0-9a-f]{6}$/i;
const WHITE = "#ffffff";
/** The dark text a pale colour gets: the app's near-black foreground. */
const DARK = "#1f1d24";
const BLACK = "#000000";
const AA = 4.5;
/** How much of a custom colour its light tint keeps; the palette's tints are as pale. */
const LIGHT_SHARE = 0.12;
const STYLE_ID = "member-custom-colors";

const customStyles = new Map<string, MemberColorStyle>();

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** True for a `#rrggbb` the family picked, false for a named colour. */
export function isCustomColor(color: string): color is CustomColor {
  return CUSTOM.test(color);
}

/** `#rrggbb` to its three 0-255 channels. */
export function hexToRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Three channels (rounded and clamped to 0-255) to lowercase `#rrggbb`. */
export function rgbToHex({ r, g, b }: Rgb): CustomColor {
  const channel = (value: number) =>
    Math.min(255, Math.max(0, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** The WCAG contrast ratio of two `#rrggbb` colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The text colour for words drawn on a colour: white as on the named colours
 * when it is readable (4.5:1), otherwise the app's dark text, or black for the
 * few mid-tones where even that falls short.
 */
export function readableTextOn(hex: string): string {
  if (contrastRatio(WHITE, hex) >= AA) return WHITE;
  if (contrastRatio(DARK, hex) >= AA) return DARK;
  return BLACK;
}

function mix(hex: string, other: string, share: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(other);
  return rgbToHex({
    r: a.r * share + b.r * (1 - share),
    g: a.g * share + b.g * (1 - share),
    b: a.b * share + b.b * (1 - share),
  });
}

/** Escapes a Tailwind arbitrary-value class (`bg-[#4a90d9]`) for a CSS selector. */
function selector(className: string): string {
  return `.${className.replace(/([[\]#])/g, "\\$1")}`;
}

function customStyle(hex: string): MemberColorStyle {
  const light = mix(hex, WHITE, LIGHT_SHARE);
  // Coloured words sit on white and on the tint: darken until both read at AA.
  let text = hex;
  for (let share = 0.95; contrastRatio(text, light) < AA && share > 0; ) {
    text = mix(hex, BLACK, share);
    share -= 0.05;
  }
  return {
    bg: `bg-[${hex}]`,
    text: `text-[${text}]`,
    light: `bg-[${light}]`,
    hex,
  };
}

/**
 * Writes the CSS behind every custom colour's classes. Tailwind only builds the
 * classes it finds in the source, so a colour picked at run time gets its rules
 * here. The background rule also sets a readable text colour: components put
 * white words on a member's colour, which a pale custom colour cannot carry.
 *
 * The rules are unlayered, so they beat Tailwind's layered utilities: that is
 * what lets the text colour win over a `text-white` beside the class. No
 * component pairs a member colour class with a hover or dark variant, which
 * would otherwise lose to it. (An `@layer utilities` block would avoid that,
 * but the tests' jsdom cannot parse one.)
 */
function writeRules(): void {
  if (typeof document === "undefined") return;
  let element = document.getElementById(STYLE_ID);
  if (!element) {
    element = document.createElement("style");
    element.id = STYLE_ID;
    document.head.appendChild(element);
  }
  const rules = [...customStyles.values()].flatMap((style) => [
    `${selector(style.bg)} { background-color: ${style.hex}; color: ${readableTextOn(style.hex)}; }`,
    `${selector(style.text)} { color: ${style.text.slice(6, -1)}; }`,
    `${selector(style.light)} { background-color: ${style.light.slice(4, -1)}; }`,
  ]);
  element.textContent = rules.join("\n");
}

/**
 * The classes and hex to draw a member's colour with: a named colour's from
 * `colorMap`, or, for a custom `#rrggbb`, classes of the same shape whose CSS is
 * added to the page the first time the colour is used. Anything else (a colour
 * this version does not know) draws as coral rather than breaking the screen.
 */
export function memberColor(color: FamilyColor): MemberColorStyle {
  if (Object.hasOwn(colorMap, color)) return colorMap[color as PaletteColor];
  if (!isCustomColor(color)) return colorMap.coral;
  const hex = color.toLowerCase();
  let style = customStyles.get(hex);
  if (!style) {
    style = customStyle(hex);
    customStyles.set(hex, style);
    writeRules();
  }
  return style;
}
