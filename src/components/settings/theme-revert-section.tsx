import { useState } from "react";
import { useFamilyData, useUpdateFamily } from "@/api";
import { FormError } from "@/components/ui/form-error";
import { Label } from "@/components/ui/label";

const CHOICES: ReadonlyArray<{ minutes: number; label: string }> = [
  { minutes: 0, label: "Never" },
  { minutes: 5, label: "5 minutes" },
  { minutes: 15, label: "15 minutes" },
  { minutes: 60, label: "1 hour" },
];

/**
 * How long a screen keeps someone's own theme, once tapped, with nobody
 * touching it, before going back to its own look. One choice for the whole
 * family, followed by every screen; saved as soon as it is picked.
 */
export function ThemeRevertSection() {
  const minutes = useFamilyData()?.themeRevertMinutes ?? 0;
  const [saveError, setSaveError] = useState<string | null>(null);
  const updateFamily = useUpdateFamily({
    onError: (error) => setSaveError(error.message),
  });

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Personal themes
      </h3>
      <div className="space-y-2">
        <Label htmlFor="theme-revert">Revert to System Default Theme</Label>
        <select
          id="theme-revert"
          value={String(minutes)}
          onChange={(event) => {
            setSaveError(null);
            updateFamily.mutate({
              themeRevertMinutes: Number(event.target.value),
            });
          }}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-[15px] leading-5 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {CHOICES.map((choice) => (
            <option key={choice.minutes} value={choice.minutes}>
              {choice.label}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground">
          After someone taps their picture, a screen shows their theme until
          nobody has touched it for this long, then goes back to its own look.
          Every screen follows this.
        </p>
        <FormError message={saveError ?? undefined} />
      </div>
    </section>
  );
}
