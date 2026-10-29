import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useFamilyData, useUpdateFamily, weatherKeys } from "@/api";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TeamsSection } from "./teams-section";

interface WeatherSportsTabProps {
  /** Told whenever a typed weather location is unsaved or not. */
  onDirtyChange?: (dirty: boolean) => void;
}

/** Settings → Weather & Sports: where the forecast is for, and the teams followed. */
export function WeatherSportsTab({ onDirtyChange }: WeatherSportsTabProps) {
  const family = useFamilyData();

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
  // Everything else in the settings applies the moment it is picked; only a
  // typed weather location waits for its Save button, so only it can be lost.
  useEffect(() => {
    onDirtyChange?.(locationChanged);
  }, [locationChanged, onDirtyChange]);

  const saveLocation = () => {
    if (!locationChanged) return;
    setLocationError(null);
    updateLocationMutation.mutate({ weatherLocation: locationDraft.trim() });
  };

  return (
    <>
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

      <TeamsSection />
    </>
  );
}
