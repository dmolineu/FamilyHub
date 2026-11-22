import type { ApiException } from "@/api/client";
import { toast } from "@/components/ui/toaster";
import { isOfflineWriteError } from "@/lib/offline/read-only-guard";

/**
 * Tells the family why a calendar change was not saved. Since Phase 4 a change goes to
 * Google first and can be refused for reasons they can act on (it changed in Google
 * meanwhile, an account must sign in again, Google is down); the API's message says
 * which, so it is shown rather than dropped.
 */
export function notifyCalendarWriteError(error: ApiException): void {
  // Read before the offline guard, which narrows the other branch away.
  const reason = error.message;
  if (
    isOfflineWriteError(error) ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  ) {
    toast({
      title: "You're offline",
      description: "Changes can't be saved until you reconnect.",
    });
    return;
  }
  toast({
    title: "Not saved to Google Calendar",
    description: reason,
    variant: "destructive",
  });
}
