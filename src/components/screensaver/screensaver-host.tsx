import { lazy, Suspense, useEffect } from "react";
import { OptionalChunkBoundary } from "@/components/shared/lazy-module";
import { useScreensaverIdle } from "@/hooks";
import { useScreensaverStore } from "@/stores";

// Split out of the entry chunk: it only loads the first time it is shown.
const Screensaver = lazy(() =>
  import("./screensaver").then((m) => ({ default: m.Screensaver })),
);

interface ScreensaverHostProps {
  /** Signed in and set up; the screensaver never covers login or onboarding. */
  enabled: boolean;
}

/** Starts the screensaver after this device's idle time and shows it. */
export function ScreensaverHost({ enabled }: ScreensaverHostProps) {
  useScreensaverIdle(enabled);
  const isActive = useScreensaverStore((s) => s.isActive);
  const stop = useScreensaverStore((s) => s.stop);

  // Signing out while it shows must not leave it covering the login screen.
  useEffect(() => {
    if (!enabled && isActive) stop();
  }, [enabled, isActive, stop]);

  if (!enabled || !isActive) return null;
  return (
    <OptionalChunkBoundary>
      <Suspense
        fallback={
          <div className="fixed inset-0 z-[200] bg-black" aria-hidden="true" />
        }
      >
        <Screensaver onDismiss={stop} />
      </Suspense>
    </OptionalChunkBoundary>
  );
}
