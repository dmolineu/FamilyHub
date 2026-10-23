import { Check, Moon } from "lucide-react";
import type { ThemePreview } from "@/lib/themes";
import { cn } from "@/lib/utils";

interface ThemeSwatchCardProps {
  name: string;
  description?: string;
  dark: boolean;
  preview: ThemePreview;
  selected: boolean;
  onSelect: () => void;
  /** Radio group this card belongs to; pickers for day and night need their own. */
  groupName?: string;
}

/**
 * One look in the Appearance picker: a native radio whose label is the whole
 * card, so screen readers announce "Midnight, radio, checked". The card shows a
 * miniature of the app drawn in the look's own colours, over its backdrop
 * picture when it has one.
 */
export function ThemeSwatchCard({
  name,
  description,
  dark,
  preview,
  selected,
  onSelect,
  groupName = "family-hub-look",
}: ThemeSwatchCardProps) {
  // Neutral stand-ins for anything the look leaves undefined.
  const background = preview.background ?? (dark ? "#1f1f1f" : "#f5f5f5");
  const card = preview.card ?? (dark ? "#2a2a2a" : "#ffffff");
  const primary = preview.primary ?? "#7a5af8";
  const foreground = preview.foreground ?? (dark ? "#f5f5f5" : "#333333");
  const accent = preview.accent ?? card;

  return (
    <label
      className={cn(
        "flex min-h-11 w-full cursor-pointer flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        selected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-muted-foreground/40",
      )}
    >
      <input
        type="radio"
        name={groupName}
        className="sr-only"
        checked={selected}
        onChange={onSelect}
        aria-label={name}
      />
      {/* A miniature of the app: header bar, a card with two lines of text, an
          accent chip and a primary button, over the look's background or its
          backdrop picture. */}
      <span
        data-testid="theme-preview"
        aria-hidden="true"
        className="relative block h-24 w-full overflow-hidden rounded-lg border border-black/10 bg-cover bg-center"
        style={{
          backgroundColor: background,
          backgroundImage: preview.thumbnail
            ? `url("${preview.thumbnail}")`
            : undefined,
        }}
      >
        <span
          className="absolute inset-x-0 top-0 flex h-5 items-center justify-between px-2"
          style={{ backgroundColor: card, opacity: 0.95 }}
        >
          <span
            className="h-1.5 w-10 rounded-full"
            style={{ backgroundColor: foreground, opacity: 0.8 }}
          />
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: primary }}
          />
        </span>
        <span
          data-testid="theme-preview-card"
          className="absolute inset-x-2 top-7 flex h-11 flex-col justify-center gap-1.5 rounded-md px-2"
          style={{ backgroundColor: card, opacity: 0.95 }}
        >
          <span
            data-testid="theme-preview-text"
            className="h-1.5 w-3/4 rounded-full"
            style={{ backgroundColor: foreground, opacity: 0.85 }}
          />
          <span
            className="h-1.5 w-1/2 rounded-full"
            style={{ backgroundColor: foreground, opacity: 0.45 }}
          />
        </span>
        <span
          className="absolute bottom-2 left-2 h-3 w-10 rounded-full"
          style={{ backgroundColor: accent, opacity: 0.9 }}
        />
        <span
          data-testid="theme-preview-primary"
          className="absolute right-2 bottom-2 h-3 w-10 rounded-full"
          style={{ backgroundColor: primary }}
        />
      </span>
      <span className="flex items-center gap-1 text-sm font-medium">
        {name}
        {dark && <Moon className="h-3.5 w-3.5 text-muted-foreground" />}
        {selected && <Check className="ml-auto h-4 w-4 text-primary" />}
      </span>
      {description && (
        <span className="text-xs text-muted-foreground">{description}</span>
      )}
    </label>
  );
}
