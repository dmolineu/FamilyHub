import { Check, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeSwatchCardProps {
  name: string;
  description?: string;
  dark: boolean;
  /** Background, card and primary colours, in that order. */
  swatch: readonly [string, string, string];
  selected: boolean;
  onSelect: () => void;
}

/**
 * One look in the Appearance picker: a native radio whose label is the whole
 * card, so screen readers announce "Midnight, radio, checked".
 */
export function ThemeSwatchCard({
  name,
  description,
  dark,
  swatch,
  selected,
  onSelect,
}: ThemeSwatchCardProps) {
  const [background, card, primary] = swatch;
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
      {/* A real radio keeps keyboard and screen-reader behaviour native; the
          card is its label. */}
      <input
        type="radio"
        name="family-hub-look"
        className="sr-only"
        checked={selected}
        onChange={onSelect}
        aria-label={name}
      />
      <span
        aria-hidden="true"
        className="flex h-9 w-full items-center gap-1 rounded-lg border border-black/5 p-1"
        style={{ backgroundColor: background }}
      >
        <span
          className="h-full flex-1 rounded-md"
          style={{ backgroundColor: card }}
        />
        <span
          className="h-full w-5 rounded-md"
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
