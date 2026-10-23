import { useLayoutEffect } from "react";
import { applyThemeToDocument } from "@/lib/themes";
import { useThemeStore } from "@/stores/theme-store";

/**
 * Paints the device's chosen look onto `<html>` and keeps it in step with the
 * theme store. Mounted once at the app root; the boot script in index.html
 * paints the same look before React loads so there is no flash.
 */
export function useApplyTheme(): void {
  const selection = useThemeStore((s) => s.selection);
  const appliedPack = useThemeStore((s) => s.appliedPack);
  useLayoutEffect(() => {
    applyThemeToDocument(selection, appliedPack);
  }, [selection, appliedPack]);
}
