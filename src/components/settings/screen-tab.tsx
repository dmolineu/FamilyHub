import { Download, Sun, Trash2, Upload, Vibrate } from "lucide-react";
import { useRef, useState } from "react";
import {
  themePackFileName,
  useDeleteThemePack,
  useExportThemePack,
  useFamilyData,
  useImportThemePack,
  useSelectThemePack,
  useThemePacks,
} from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { sunContextFor } from "@/hooks/use-apply-theme";
import { canVibrate } from "@/lib/haptics";
import { sunTimes } from "@/lib/sun";
import {
  BUILT_IN_THEMES,
  packPreview,
  type ThemeSelection,
} from "@/lib/themes";
import type { ThemePackDocument, ThemePackSummary } from "@/lib/types";
import {
  type HapticCategory,
  SCREENSAVER_DELAYS,
  type ScreensaverDelay,
  useHapticsPreference,
  useScreensaverStore,
  useThemeStore,
} from "@/stores";
import { useDisplayStore } from "@/stores/display-store";
import { ThemeSwatchCard } from "./theme-swatch-card";

const SUB_TOGGLES: ReadonlyArray<{ key: HapticCategory; label: string }> = [
  { key: "taps", label: "Taps" },
  { key: "completions", label: "Completions" },
  { key: "back", label: "Back" },
];

/**
 * Settings → This screen: how this device looks and behaves (wall display,
 * screensaver, look, haptics). Everything here is stored in this browser only,
 * except the theme packs, which are family data every device can pick from.
 */
export function ScreenTab() {
  const family = useFamilyData();

  // The look is a device preference, never family data; the packs it can pick
  // from are family data.
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const themeSelection = useThemeStore((s) => s.selection);
  const setThemeSelection = useThemeStore((s) => s.setSelection);
  const daySelection = useThemeStore((s) => s.daySelection);
  const setDaySelection = useThemeStore((s) => s.setDaySelection);
  const nightSelection = useThemeStore((s) => s.nightSelection);
  const setNightSelection = useThemeStore((s) => s.setNightSelection);
  const appliedPacks = useThemeStore((s) => s.appliedPacks);
  const sunSummary = themeMode === "sun" ? describeSunToday(family) : null;
  const themePacks = useThemePacks();
  const [packStatus, setPackStatus] = useState<string | null>(null);
  const [packError, setPackError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const packFileInputRef = useRef<HTMLInputElement>(null);
  const importPack = useImportThemePack({
    onSuccess: (summary) => setPackStatus(`${summary.name} imported.`),
    onError: (error) => setPackError(error.message),
  });
  const selectPack = useSelectThemePack({
    onError: (error) => setPackError(error.message),
  });
  const exportPack = useExportThemePack({
    onError: (error) => setPackError(error.message),
  });
  const deletePack = useDeleteThemePack({
    onError: (error) => setPackError(error.message),
  });

  const handlePackFileChosen = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPackError(null);
    setPackStatus(null);
    // FileReader rather than file.text(): the latter is missing in older WebViews.
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as ThemePackDocument;
        if (
          !parsed ||
          parsed.version !== 1 ||
          typeof parsed.name !== "string" ||
          typeof parsed.tokens !== "object"
        ) {
          throw new Error("shape");
        }
        importPack.mutate(parsed);
      } catch {
        setPackError("That is not a theme pack file.");
      }
    };
    reader.onerror = () => setPackError("That file could not be read.");
    reader.readAsText(file);
  };

  const renderLookPicker = (
    label: string,
    groupName: string,
    selected: ThemeSelection,
    chooseBuiltIn: (id: (typeof BUILT_IN_THEMES)[number]["id"]) => void,
    target: "single" | "day" | "night",
  ) => (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {BUILT_IN_THEMES.map((theme) => (
        <ThemeSwatchCard
          key={theme.id}
          groupName={groupName}
          name={theme.name}
          description={theme.description}
          dark={theme.dark}
          preview={theme.preview}
          selected={selected.kind === "builtin" && selected.id === theme.id}
          onSelect={() => chooseBuiltIn(theme.id)}
        />
      ))}
      {(themePacks.data ?? []).map((pack) => (
        <ThemeSwatchCard
          key={pack.id}
          groupName={groupName}
          name={pack.name}
          description="Imported theme pack"
          dark={pack.dark}
          preview={packPreview(pack, appliedPacks[pack.id])}
          selected={selected.kind === "pack" && selected.id === pack.id}
          onSelect={() => selectPack.mutate({ summary: pack, target })}
        />
      ))}
    </div>
  );

  const downloadPack = (summary: ThemePackSummary) => {
    setPackError(null);
    exportPack.mutate(summary.id, {
      onSuccess: (document) => {
        const blob = new Blob([JSON.stringify(document, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement("a");
        link.href = url;
        link.download = themePackFileName(document.name);
        link.click();
        URL.revokeObjectURL(url);
      },
    });
  };

  // The screensaver, like the look, is chosen per device.
  const displayMode = useDisplayStore((s) => s.mode);
  const setDisplayMode = useDisplayStore((s) => s.setMode);
  const screensaverDelay = useScreensaverStore((s) => s.delay);
  const setScreensaverDelay = useScreensaverStore((s) => s.setDelay);
  const startScreensaver = useScreensaverStore((s) => s.start);
  const night = useScreensaverStore((s) => s.night);
  const setNight = useScreensaverStore((s) => s.setNight);

  const hapticsSupported = canVibrate();
  const hapticsEnabled = useHapticsPreference((s) => s.enabled);
  const hapticCategories = useHapticsPreference((s) => s.categories);
  const setHapticsEnabled = useHapticsPreference((s) => s.setEnabled);
  const setHapticCategory = useHapticsPreference((s) => s.setCategory);

  return (
    <>
      {/* Display: this device only */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Display
        </h3>
        <Label
          htmlFor="wall-display"
          className="flex min-h-11 items-center justify-between gap-3"
        >
          <span>
            Wall display
            <span className="block text-xs font-normal text-muted-foreground">
              Larger text and buttons, and the day fits the screen, for a screen
              read from across the room. This device only.
            </span>
          </span>
          <Switch
            id="wall-display"
            aria-label="Wall display"
            checked={displayMode === "wall"}
            onCheckedChange={(on) => setDisplayMode(on ? "wall" : "standard")}
          />
        </Label>
      </section>

      {/* Screensaver: this device only */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Screensaver
        </h3>
        <Label htmlFor="screensaver-delay">Start the screensaver after</Label>
        <select
          id="screensaver-delay"
          value={String(screensaverDelay)}
          onChange={(event) =>
            setScreensaverDelay(parseScreensaverDelay(event.target.value))
          }
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-[15px] leading-5 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {SCREENSAVER_DELAYS.map((delay) => (
            <option key={String(delay)} value={String(delay)}>
              {screensaverDelayLabel(delay)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          The photos from the Photos screen every 10 seconds, with the time, the
          weather and everyone's birthday countdown. Swipe to change photo; tap
          to close. This setting is for this device only.
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={startScreensaver}
        >
          Show it now
        </Button>
        <Label className="flex min-h-11 items-center justify-between gap-3">
          <span>
            Dark at night
            <span className="block text-xs font-normal text-muted-foreground">
              The screensaver is a dark screen during these hours; a tap still
              wakes it.
            </span>
          </span>
          <Switch
            aria-label="Dark at night"
            checked={night.enabled}
            onCheckedChange={(enabled) => setNight({ enabled })}
          />
        </Label>
        {night.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="night-from">Dark from</Label>
              <Input
                id="night-from"
                type="time"
                value={night.from}
                onChange={(event) =>
                  event.target.value && setNight({ from: event.target.value })
                }
                className="h-11 bg-input"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="night-to">Until</Label>
              <Input
                id="night-to"
                type="time"
                value={night.to}
                onChange={(event) =>
                  event.target.value && setNight({ to: event.target.value })
                }
                className="h-11 bg-input"
              />
            </div>
          </div>
        )}
      </section>

      {/* Appearance Section — per device, stored in this browser only */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Appearance
        </h3>
        <p className="text-xs text-muted-foreground">
          The look applies to this device only; the wall, phones and laptops can
          each have their own. With the sun switch on, this device uses the
          daytime look between sunrise and sunset and the night-time look
          otherwise.
        </p>
        <Label
          htmlFor="theme-sun"
          className="flex min-h-11 items-center justify-between gap-3 font-medium"
        >
          <span className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            Change with the sun
          </span>
          <Switch
            id="theme-sun"
            aria-label="Change with the sun"
            checked={themeMode === "sun"}
            onCheckedChange={(on) => setThemeMode(on ? "sun" : "single")}
          />
        </Label>
        {themeMode === "sun" ? (
          <div className="space-y-4">
            {sunSummary && (
              <p className="text-xs text-muted-foreground">{sunSummary}</p>
            )}
            <div className="space-y-2">
              <p className="text-sm font-medium">Daytime look</p>
              {renderLookPicker(
                "Daytime look",
                "family-hub-look-day",
                daySelection,
                (id) => setDaySelection({ kind: "builtin", id }),
                "day",
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Night-time look</p>
              {renderLookPicker(
                "Night-time look",
                "family-hub-look-night",
                nightSelection,
                (id) => setNightSelection({ kind: "builtin", id }),
                "night",
              )}
            </div>
          </div>
        ) : (
          renderLookPicker(
            "Look",
            "family-hub-look",
            themeSelection,
            (id) => setThemeSelection({ kind: "builtin", id }),
            "single",
          )
        )}
        {(themePacks.data ?? []).length > 0 && (
          <ul className="space-y-1">
            {(themePacks.data ?? []).map((pack) => (
              <li key={pack.id} className="flex items-center gap-1 text-sm">
                <span className="min-w-0 flex-1 truncate">{pack.name}</span>
                {confirmingDeleteId === pack.id ? (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      aria-label={`Confirm delete ${pack.name}`}
                      disabled={deletePack.isPending}
                      onClick={() => {
                        setConfirmingDeleteId(null);
                        deletePack.mutate(pack.id);
                      }}
                    >
                      Confirm delete
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Export ${pack.name}`}
                      disabled={exportPack.isPending}
                      onClick={() => downloadPack(pack)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${pack.name}`}
                      onClick={() => setConfirmingDeleteId(pack.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={importPack.isPending}
            onClick={() => packFileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {importPack.isPending ? "Importing…" : "Import theme pack"}
          </Button>
          <input
            ref={packFileInputRef}
            type="file"
            accept="application/json,.json"
            aria-label="Import theme pack"
            className="sr-only"
            onChange={handlePackFileChosen}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Theme packs are shared by the whole family and travel in the backup
          file; which one each device shows is still that device's choice.
        </p>
        {packError && <p className="text-sm text-destructive">{packError}</p>}
        {packStatus && (
          <p role="status" className="text-sm text-muted-foreground">
            {packStatus}
          </p>
        )}
      </section>

      {/* Haptics Section — canVibrate() gates on the Vibration API + a coarse
      (touch) pointer, so this is hidden on iOS Safari and on desktop
      Chrome/Edge/Firefox (which define a no-op navigator.vibrate). */}
      {hapticsSupported && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Haptics
          </h3>
          <Label
            htmlFor="haptics-master"
            className="flex min-h-11 items-center justify-between gap-3 font-medium"
          >
            <span className="flex items-center gap-2">
              <Vibrate className="h-4 w-4" />
              Enable haptics
            </span>
            <Switch
              id="haptics-master"
              aria-label="Enable haptics"
              checked={hapticsEnabled}
              onCheckedChange={setHapticsEnabled}
            />
          </Label>
          {hapticsEnabled && (
            <div className="space-y-1 pl-6">
              {SUB_TOGGLES.map(({ key, label }) => (
                <Label
                  key={key}
                  htmlFor={`haptics-${key}`}
                  className="flex min-h-11 items-center justify-between gap-3 font-normal text-muted-foreground"
                >
                  {label}
                  <Switch
                    id={`haptics-${key}`}
                    aria-label={label}
                    checked={hapticCategories[key]}
                    onCheckedChange={(on) => setHapticCategory(key, on)}
                  />
                </Label>
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function screensaverDelayLabel(delay: ScreensaverDelay): string {
  if (delay === "auto") return "Automatic (10 minutes on a wall display)";
  if (delay === "off") return "Never";
  if (delay === 60) return "1 hour";
  return `${delay} minute${delay === 1 ? "" : "s"}`;
}

function parseScreensaverDelay(value: string): ScreensaverDelay {
  const match = SCREENSAVER_DELAYS.find((delay) => String(delay) === value);
  return match ?? "auto";
}

/** "Today: sunrise 6:48 AM, sunset 4:47 PM, from your weather location." */
function describeSunToday(
  family: {
    timezone?: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null,
): string {
  const sun = sunContextFor(family);
  const now = new Date();
  const times = sunTimes(now, sun.coordinates, sun.timeZone);
  const source = sun.approximate
    ? `estimated from the ${sun.timeZone} time zone`
    : "from your weather location";
  if (times.kind === "polar-day")
    return `Today: the sun does not set here, ${source}.`;
  if (times.kind === "polar-night")
    return `Today: the sun does not rise here, ${source}.`;
  const clock = (date: Date) =>
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: sun.timeZone,
    });
  return `Today: sunrise ${clock(times.sunrise)}, sunset ${clock(times.sunset)}, ${source}.`;
}
