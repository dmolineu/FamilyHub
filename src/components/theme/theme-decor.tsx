import { isImageDataUrl } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme-store";

/**
 * Image slots an imported theme pack can fill. Each renders nothing unless the
 * device is showing a pack that provides the slot, so built-in looks and
 * components that embed these cost nothing.
 */

function useActivePack() {
  const resolved = useThemeStore((s) => s.resolved);
  const pack = useThemeStore((s) => s.appliedPack);
  return resolved.theme === "pack" ? pack : null;
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

/** Up to three small decorative figures, hidden from assistive tech. */
export function ThemeMascots({ className }: { className?: string }) {
  const pack = useActivePack();
  const sources = (pack?.slots?.mascots ?? [])
    .map((key) => slotImage(pack, key))
    .filter((src): src is string => src !== null)
    .slice(0, 3);
  if (sources.length === 0) return null;
  return (
    <div
      data-testid="theme-mascots"
      aria-hidden="true"
      className={cn("pointer-events-none flex items-end gap-1", className)}
    >
      {sources.map((src) => (
        <img key={src.slice(0, 64)} src={src} alt="" className="h-10 w-auto" />
      ))}
    </div>
  );
}
