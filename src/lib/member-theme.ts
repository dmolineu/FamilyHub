import { isBuiltInThemeId, type ThemeSelection } from "@/lib/themes";

/**
 * A member's own look, as the server stores it: `builtin:<id>` or
 * `pack:<pack name>`. Packs go by name so a member keeps their look when the
 * family re-imports a newer version of a pack (which gets a new id).
 */

const BUILT_IN_PREFIX = "builtin:";
const PACK_PREFIX = "pack:";

type NamedPack = { id: string; name: string };

/**
 * The look to show for a member's theme, or null for the screen's own look,
 * which is also what a look or pack that no longer exists comes to.
 */
export function memberThemeSelection(
  theme: string | null | undefined,
  packs: ReadonlyArray<NamedPack>,
): ThemeSelection | null {
  if (!theme) return null;
  if (theme.startsWith(BUILT_IN_PREFIX)) {
    const id = theme.slice(BUILT_IN_PREFIX.length);
    return isBuiltInThemeId(id) ? { kind: "builtin", id } : null;
  }
  if (theme.startsWith(PACK_PREFIX)) {
    const name = theme.slice(PACK_PREFIX.length).trim().toLowerCase();
    const pack = packs.find((p) => p.name.trim().toLowerCase() === name);
    return pack ? { kind: "pack", id: pack.id } : null;
  }
  return null;
}

/** The value to store for a look; null keeps the screen's own. */
export function memberThemeValue(
  selection: ThemeSelection | null,
  packs: ReadonlyArray<NamedPack>,
): string | null {
  if (!selection) return null;
  if (selection.kind === "builtin") return `${BUILT_IN_PREFIX}${selection.id}`;
  const pack = packs.find((p) => p.id === selection.id);
  return pack ? `${PACK_PREFIX}${pack.name}` : null;
}

/** Whether two looks are the same look. */
export function sameSelection(a: ThemeSelection, b: ThemeSelection): boolean {
  return a.kind === b.kind && a.id === b.id;
}
