import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Download,
  LocateFixed,
  Trash2,
  Upload,
  Vibrate,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  themePackFileName,
  useDeleteThemePack,
  useExportThemePack,
  useFamilyData,
  useImportThemePack,
  useSelectThemePack,
  useThemePacks,
  useUpdateFamily,
  weatherKeys,
} from "@/api";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Switch } from "@/components/ui/switch";
import { canVibrate } from "@/lib/haptics";
import { BUILT_IN_THEMES, packSwatch } from "@/lib/themes";
import type { ThemePackDocument, ThemePackSummary } from "@/lib/types";
import {
  type HapticCategory,
  useHapticsPreference,
  useThemeStore,
} from "@/stores";
import { ThemeSwatchCard } from "./theme-swatch-card";

/**
 * Curated US zones offered in the timezone select. The family's current zone
 * is appended when it is not in this list, so non-US families always see
 * their stored value.
 */
const CURATED_TIMEZONES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "America/New_York", label: "Eastern — America/New_York" },
  { id: "America/Chicago", label: "Central — America/Chicago" },
  { id: "America/Denver", label: "Mountain — America/Denver" },
  { id: "America/Phoenix", label: "Arizona — America/Phoenix" },
  { id: "America/Los_Angeles", label: "Pacific — America/Los_Angeles" },
  { id: "America/Anchorage", label: "Alaska — America/Anchorage" },
  { id: "Pacific/Honolulu", label: "Hawaii — Pacific/Honolulu" },
];

const COMING_SOON_ROWS = [{ icon: Bell, label: "Notifications" }] as const;

const SUB_TOGGLES: ReadonlyArray<{ key: HapticCategory; label: string }> = [
  { key: "taps", label: "Taps" },
  { key: "completions", label: "Completions" },
  { key: "back", label: "Back" },
];

interface PreferencesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Family-wide app preferences: the BE-backed family timezone plus disabled
 * roadmap stubs. Family Settings owns "who we are"; this surface owns "how
 * the app behaves".
 */
export function PreferencesSheet({
  open,
  onOpenChange,
}: PreferencesSheetProps) {
  const family = useFamilyData();
  // Shown straight from GET /family — undefined (no default) until it loads.
  const timezone = family?.timezone;

  const [saveError, setSaveError] = useState<string | null>(null);
  const updateFamilyMutation = useUpdateFamily({
    onError: (error) => setSaveError(error.message),
  });

  // Weather location: the server geocodes what is typed and answers with the
  // resolved place name, which replaces the draft once it arrives.
  const queryClient = useQueryClient();
  const savedLocation = family?.weatherLocation ?? "";
  const [locationDraft, setLocationDraft] = useState(savedLocation);
  const [locationError, setLocationError] = useState<string | null>(null);
  useEffect(() => {
    setLocationDraft(savedLocation);
  }, [savedLocation]);
  const updateLocationMutation = useUpdateFamily({
    onError: (error) => setLocationError(error.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: weatherKeys.all });
    },
  });
  const locationChanged = locationDraft.trim() !== savedLocation;

  const saveLocation = () => {
    if (!locationChanged) return;
    setLocationError(null);
    updateLocationMutation.mutate({ weatherLocation: locationDraft.trim() });
  };

  // The look is a device preference, never family data; the packs it can pick
  // from are family data.
  const themeSelection = useThemeStore((s) => s.selection);
  const setThemeSelection = useThemeStore((s) => s.setSelection);
  const appliedPack = useThemeStore((s) => s.appliedPack);
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

  const hapticsSupported = canVibrate();
  const hapticsEnabled = useHapticsPreference((s) => s.enabled);
  const hapticCategories = useHapticsPreference((s) => s.categories);
  const setHapticsEnabled = useHapticsPreference((s) => s.setEnabled);
  const setHapticCategory = useHapticsPreference((s) => s.setCategory);

  const saveTimezone = (zone: string) => {
    if (!zone || zone === timezone) return;
    setSaveError(null);
    updateFamilyMutation.mutate({ timezone: zone });
  };

  const useDeviceTimezone = () => {
    saveTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  };

  const zoneOptions =
    timezone && !CURATED_TIMEZONES.some((tz) => tz.id === timezone)
      ? [...CURATED_TIMEZONES, { id: timezone, label: timezone }]
      : CURATED_TIMEZONES;

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Preferences"
      initialHeight="full"
      dialogClassName="max-w-lg"
      titleClassName="text-xl"
      desktopHeaderRight={
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
          className="h-11 w-11"
        >
          <X className="h-4 w-4" />
        </Button>
      }
    >
      <div className="space-y-8 py-4">
        {/* Family Timezone Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Family Timezone
          </h3>
          <div className="space-y-2">
            <Label htmlFor="family-timezone">Family timezone</Label>
            <select
              id="family-timezone"
              value={timezone ?? ""}
              onChange={(event) => saveTimezone(event.target.value)}
              className="h-11 w-full rounded-lg border border-input bg-background px-3 text-[15px] leading-5 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {timezone === undefined && (
                <option value="" disabled>
                  Loading timezone…
                </option>
              )}
              {zoneOptions.map((tz) => (
                <option key={tz.id} value={tz.id}>
                  {tz.label}
                </option>
              ))}
            </select>
            <FormError message={saveError ?? undefined} />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={useDeviceTimezone}
            className="gap-2"
          >
            <LocateFixed className="h-4 w-4" />
            Use this device's timezone
          </Button>
        </section>

        {/* Weather Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Weather
          </h3>
          <div className="space-y-2">
            <Label htmlFor="weather-location">Weather location</Label>
            <Input
              id="weather-location"
              value={locationDraft}
              onChange={(event) => setLocationDraft(event.target.value)}
              placeholder="City, state or postal code"
              className="bg-input"
            />
            <p className="text-xs text-muted-foreground">
              Shown on the Home screen. Leave empty to turn the forecast off.
            </p>
            <FormError message={locationError ?? undefined} />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={saveLocation}
            disabled={!locationChanged || updateLocationMutation.isPending}
          >
            {updateLocationMutation.isPending ? "Saving…" : "Save location"}
          </Button>
        </section>

        {/* Appearance Section — per device, stored in this browser only */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Appearance
          </h3>
          <p className="text-xs text-muted-foreground">
            The look applies to this device only; the wall, phones and laptops
            can each have their own.
          </p>
          <div
            role="radiogroup"
            aria-label="Look"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {BUILT_IN_THEMES.map((theme) => (
              <ThemeSwatchCard
                key={theme.id}
                name={theme.name}
                description={theme.description}
                dark={theme.dark}
                swatch={theme.swatch}
                selected={
                  themeSelection.kind === "builtin" &&
                  themeSelection.id === theme.id
                }
                onSelect={() =>
                  setThemeSelection({ kind: "builtin", id: theme.id })
                }
              />
            ))}
            {(themePacks.data ?? []).map((pack) => (
              <div key={pack.id} className="flex flex-col gap-1">
                <ThemeSwatchCard
                  name={pack.name}
                  description="Imported theme pack"
                  dark={pack.dark}
                  swatch={packSwatch(
                    appliedPack?.id === pack.id ? appliedPack.tokens : {},
                    pack.dark,
                  )}
                  selected={
                    themeSelection.kind === "pack" &&
                    themeSelection.id === pack.id
                  }
                  onSelect={() => selectPack.mutate(pack)}
                />
                <div className="flex items-center gap-1">
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
                </div>
              </div>
            ))}
          </div>
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

        {/* Coming Soon Section */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Coming Soon
          </h3>
          <div className="space-y-1">
            {COMING_SOON_ROWS.map((row) => {
              const Icon = row.icon;
              return (
                <button
                  key={row.label}
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="w-full min-h-11 flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-muted-foreground opacity-60 cursor-not-allowed"
                >
                  <Icon className="h-5 w-5" />
                  {row.label}
                  <span className="ml-auto text-xs font-normal rounded-full border border-border px-2 py-0.5">
                    Coming soon
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </ResponsiveFormDialog>
  );
}
