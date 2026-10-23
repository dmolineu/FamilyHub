/**
 * Looks (themes) for the app.
 *
 * A look is chosen per device, never per family: the wall can be in one look
 * while a phone stays in another. Three looks are built in and live in
 * `index.css` as token blocks keyed by `data-theme`; any number of "theme
 * packs" (self-contained JSON documents with their own tokens and images) can
 * be imported per family and are applied as inline custom properties.
 */

export type BuiltInThemeId = "default" | "midnight" | "sunrise";

/** Colours (and optional thumbnail) a card is drawn from; nulls fall back to neutrals. */
export interface ThemePreview {
  background: string | null;
  card: string | null;
  primary: string | null;
  foreground: string | null;
  accent: string | null;
  thumbnail: string | null;
}

export interface BuiltInTheme {
  id: BuiltInThemeId;
  name: string;
  description: string;
  dark: boolean;
  /** What the Appearance card draws: a miniature of the app in this look. */
  preview: ThemePreview;
  /** `<meta name="theme-color">` value while this look is active. */
  chromeColor: string;
}

export const BUILT_IN_THEMES: readonly BuiltInTheme[] = [
  {
    id: "default",
    name: "Default",
    description: "Warm cream with purple accents",
    dark: false,
    preview: {
      background: "#faf8f5",
      card: "#ffffff",
      primary: "#7a5af8",
      foreground: "#2b2f3d",
      accent: "#efe9df",
      thumbnail: null,
    },
    chromeColor: "#faf8f5",
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Dark blue-grey for evenings and dim rooms",
    dark: true,
    preview: {
      background: "#1b1d2a",
      card: "#262938",
      primary: "#a99bff",
      foreground: "#eceaf3",
      accent: "#323650",
      thumbnail: null,
    },
    chromeColor: "#1b1d2a",
  },
  {
    id: "sunrise",
    name: "Sunrise",
    description: "Warm peach with coral accents",
    dark: false,
    preview: {
      background: "#fdf1e7",
      card: "#fffaf5",
      primary: "#e8714a",
      foreground: "#4a3a30",
      accent: "#f8e4c8",
      thumbnail: null,
    },
    chromeColor: "#fdf1e7",
  },
];

export const DEFAULT_THEME_ID: BuiltInThemeId = "default";

export type ThemeSelection =
  | { kind: "builtin"; id: BuiltInThemeId }
  | { kind: "pack"; id: string };

export const DEFAULT_THEME_SELECTION: ThemeSelection = {
  kind: "builtin",
  id: DEFAULT_THEME_ID,
};

/**
 * The part of an imported theme pack a device keeps locally so the look can be
 * painted before the app (or the network) is up.
 */
export interface AppliedPack {
  id: string;
  name: string;
  dark: boolean;
  /** CSS custom properties, e.g. `"--primary": "#ffc425"`. */
  tokens: Record<string, string>;
  /** Image slots by key, each an image data URL. */
  images: Record<string, string>;
  /** Which image fills which spot (header logo, home banner, mascots). */
  slots?: {
    headerLogo?: string;
    homeBanner?: string;
    mascots?: string[];
  };
}

/** What `<html>` ends up carrying: its `data-theme` value and the dark flag. */
export interface ResolvedDocumentTheme {
  theme: BuiltInThemeId | "pack";
  dark: boolean;
}

export function isBuiltInThemeId(id: string): id is BuiltInThemeId {
  return BUILT_IN_THEMES.some((t) => t.id === id);
}

export function getBuiltInTheme(id: BuiltInThemeId): BuiltInTheme {
  return BUILT_IN_THEMES.find((t) => t.id === id) ?? BUILT_IN_THEMES[0];
}

/**
 * A pack selection only counts while that pack is cached on the device;
 * otherwise the Default look is used so the screen never goes blank.
 */
export function resolveDocumentTheme(
  selection: ThemeSelection,
  pack: AppliedPack | null,
): ResolvedDocumentTheme {
  if (selection.kind === "builtin") {
    return { theme: selection.id, dark: getBuiltInTheme(selection.id).dark };
  }
  if (pack && pack.id === selection.id) {
    return { theme: "pack", dark: pack.dark };
  }
  return { theme: DEFAULT_THEME_ID, dark: false };
}

// Pack tokens are written as inline custom properties on <html>. They come from
// an imported file, so both name and value are checked before they touch the DOM.
const TOKEN_NAME = /^--[a-z0-9-]+$/;
const UNSAFE_TOKEN_VALUE = /[;{}<>]|url\(|expression\(|javascript:/i;
const IMAGE_DATA_URL =
  /^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const IMAGE_KEY = /^[a-z0-9-]+$/;

export function isSafeTokenName(name: string): boolean {
  return TOKEN_NAME.test(name);
}

export function isSafeTokenValue(value: string): boolean {
  return value.length <= 400 && !UNSAFE_TOKEN_VALUE.test(value);
}

export function isImageDataUrl(value: string): boolean {
  return IMAGE_DATA_URL.test(value);
}

export function imageTokenName(key: string): string {
  return `--theme-image-${key}`;
}

function clearInlineTokens(root: HTMLElement): void {
  const names: string[] = [];
  for (let i = 0; i < root.style.length; i += 1) {
    const name = root.style.item(i);
    if (name.startsWith("--")) names.push(name);
  }
  for (const name of names) root.style.removeProperty(name);
}

function setChromeColor(color: string | null): void {
  if (!color) return;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", color);
}

/**
 * Paints a look onto the document: `data-theme`, the `dark` class, inline
 * tokens for a pack, and the browser chrome colour.
 */
export function applyThemeToDocument(
  selection: ThemeSelection,
  pack: AppliedPack | null,
  root: HTMLElement = document.documentElement,
): ResolvedDocumentTheme {
  const resolved = resolveDocumentTheme(selection, pack);
  root.dataset.theme = resolved.theme;
  root.classList.toggle("dark", resolved.dark);
  clearInlineTokens(root);

  if (resolved.theme !== "pack" || !pack) {
    const builtInId =
      resolved.theme === "pack" ? DEFAULT_THEME_ID : resolved.theme;
    setChromeColor(getBuiltInTheme(builtInId).chromeColor);
    return resolved;
  }

  for (const [name, value] of Object.entries(pack.tokens)) {
    if (isSafeTokenName(name) && isSafeTokenValue(value)) {
      root.style.setProperty(name, value);
    }
  }
  for (const [key, dataUrl] of Object.entries(pack.images)) {
    if (IMAGE_KEY.test(key) && isImageDataUrl(dataUrl)) {
      root.style.setProperty(imageTokenName(key), `url("${dataUrl}")`);
    }
  }
  const background = pack.tokens["--background"];
  setChromeColor(
    background && isSafeTokenValue(background) ? background : null,
  );
  return resolved;
}

/**
 * What to draw for an imported pack: the server's preview first, then whatever
 * the device has cached from applying the pack, then nothing (neutral fallbacks).
 */
export function packPreview(
  summary: {
    dark: boolean;
    preview?: ThemePreview | null;
  },
  cached?: {
    tokens: Record<string, string>;
    images: Record<string, string>;
  } | null,
): ThemePreview {
  const safe = (value: string | null | undefined): string | null =>
    value && isSafeTokenValue(value) ? value : null;
  const token = (name: string) => safe(cached?.tokens[name]);
  const server = summary.preview;
  const thumbnail =
    server?.thumbnail && isImageDataUrl(server.thumbnail)
      ? server.thumbnail
      : null;
  return {
    background: safe(server?.background) ?? token("--background"),
    card: safe(server?.card) ?? token("--card"),
    primary: safe(server?.primary) ?? token("--primary"),
    foreground: safe(server?.foreground) ?? token("--foreground"),
    accent: safe(server?.accent) ?? token("--accent"),
    thumbnail,
  };
}
