import { useEffect } from "react";
import { applyDisplayToDocument, displayFromUrl } from "@/lib/display";
import { useDisplayStore } from "@/stores/display-store";

/**
 * Applies this device's display mode, taking `?display=wall` from the address first so
 * a kiosk's start page picks the wall layout once and keeps it.
 */
export function useApplyDisplay(): void {
  const mode = useDisplayStore((s) => s.mode);

  useEffect(() => {
    const asked = displayFromUrl(window.location.search);
    if (asked) useDisplayStore.getState().setMode(asked);
  }, []);

  useEffect(() => {
    applyDisplayToDocument(mode);
  }, [mode]);
}
