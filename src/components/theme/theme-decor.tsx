import { isImageDataUrl } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme-store";

/**
 * Image slots an imported theme pack can fill. Each renders nothing unless the
 * device is showing a pack that provides the slot, so built-in looks and
 * components that embed these cost nothing.
 */

function useActivePack() {
  const activePackId = useThemeStore((s) => s.activePackId);
  const packs = useThemeStore((s) => s.appliedPacks);
  return activePackId ? (packs[activePackId] ?? null) : null;
}

function slotImage(
  pack: { images: Record<string, string> } | null,
  key: string | undefined,
): string | null {
  if (!pack || !key) return null;
  const url = pack.images[key];
  return url && isImageDataUrl(url) ? url : null;
}

/** The pack's emblem beside the family name in the header. */
export function ThemeHeaderLogo({ className }: { className?: string }) {
  const pack = useActivePack();
  const src = slotImage(pack, pack?.slots?.headerLogo);
  if (!pack || !src) return null;
  return (
    <img
      src={src}
      alt={pack.name}
      className={cn("inline-block h-7 w-auto align-middle", className)}
    />
  );
}

/** A wide picture above the Home dashboard. */
export function ThemeHomeBanner({ className }: { className?: string }) {
  const pack = useActivePack();
  const src = slotImage(pack, pack?.slots?.homeBanner);
  if (!src) return null;
  return (
    <img
      data-testid="theme-home-banner"
      src={src}
      alt=""
      className={cn(
        "h-40 w-full rounded-xl object-cover shadow-sm xl:h-52",
        className,
      )}
    />
  );
}

/** Up to six small decorative figures, hidden from assistive tech. */
export function ThemeMascots({ className }: { className?: string }) {
  const pack = useActivePack();
  const mascots = (pack?.slots?.mascots ?? [])
    .map((key) => ({ key, src: slotImage(pack, key) }))
    .filter((m): m is { key: string; src: string } => m.src !== null)
    .slice(0, 6);
  if (mascots.length === 0) return null;
  return (
    <div
      data-testid="theme-mascots"
      aria-hidden="true"
      className={cn("pointer-events-none flex items-end gap-1", className)}
    >
      {/* Keyed by place and slot, never by picture: same-size PNGs share
          their first bytes, and duplicate keys leave the previous look's
          mascots on screen after a switch. A pack may list one key twice. */}
      {mascots.map(({ key, src }, i) => (
        <img key={`${i}-${key}`} src={src} alt="" className="h-10 w-auto" />
      ))}
    </div>
  );
}

/**
 * A full-screen picture behind the whole app, from the pack's `background`
 * image. It only shows through where a pack also makes its `--background`
 * token translucent (an 8-digit hex such as `#fff9e6b3`); cards and popovers
 * stay opaque, so text keeps its contrast. A fixed element rather than a body
 * background because iOS ignores `background-attachment: fixed`.
 */
export function ThemeBackground() {
  const pack = useActivePack();
  const src = slotImage(pack, "background");
  if (!src) return null;
  return (
    <div
      data-testid="theme-background"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
      style={{ backgroundImage: `url("${src}")` }}
    />
  );
}
