import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect, useRef, useState } from "react";
import { ToastAction } from "@/components/ui/toast";
import { toast } from "@/components/ui/toaster";
import { useDisplayStore } from "@/stores/display-store";

/** How often a page left open asks the server whether a new version exists. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** How long a wall must go untouched before it installs a waiting update itself. */
export const WALL_UPDATE_IDLE_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "touchstart",
  "wheel",
] as const;

/**
 * Someone may be part-way through a form. The screensaver is a dialog too, but
 * nobody is typing into it, so it never holds an update back.
 */
function hasOpenDialog(): boolean {
  return Array.from(
    document.querySelectorAll(
      '[role="dialog"], [data-vaul-drawer][data-state="open"]',
    ),
  ).some((element) => !element.hasAttribute("data-screensaver"));
}

/**
 * Surfaces a user-controlled "update available" prompt instead of the old
 * `autoUpdate` silent reload. Renders nothing; mount once near the root.
 *
 * On a new service worker, shows a sticky toast with a Reload action that
 * applies the update (`updateServiceWorker(true)`). Phones and laptops are
 * never force-reloaded mid-use. A wall has nobody to tap Reload, so there a
 * waiting update installs itself after five minutes untouched with no dialog
 * open, and every page checks for a new version hourly rather than only when
 * it is reloaded.
 */
export function PWAUpdater() {
  // The Reload action's closure can't reference the same useRegisterSW call's
  // return value directly, so stash it in a ref updated after each render.
  const updateRef = useRef<(reloadPage?: boolean) => void>(() => {});
  const checkTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const [updateWaiting, setUpdateWaiting] = useState(false);
  const wall = useDisplayStore((s) => s.mode === "wall");

  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      setUpdateWaiting(true);
      toast({
        title: "Update available",
        description: "A new version of Family Hub is ready.",
        duration: Number.POSITIVE_INFINITY,
        action: (
          <ToastAction
            altText="Reload to update"
            onClick={() => updateRef.current(true)}
          >
            Reload
          </ToastAction>
        ),
      });
    },
    onOfflineReady() {
      // Honest copy: only the app shell is cached, NOT your data (Option C).
      toast({
        title: "Ready to use",
        description: "Family Hub is installed and the app shell is cached.",
      });
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      clearInterval(checkTimerRef.current);
      checkTimerRef.current = setInterval(() => {
        // Offline or the server restarting: the next hour tries again.
        registration.update().catch(() => {});
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  useEffect(() => {
    updateRef.current = updateServiceWorker;
  }, [updateServiceWorker]);

  useEffect(() => () => clearInterval(checkTimerRef.current), []);

  useEffect(() => {
    if (!wall || !updateWaiting) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (hasOpenDialog()) {
          arm();
          return;
        }
        updateRef.current(true);
      }, WALL_UPDATE_IDLE_MS);
    };

    arm();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, arm, { passive: true });
    }
    return () => {
      clearTimeout(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, arm);
      }
    };
  }, [wall, updateWaiting]);

  return null;
}
