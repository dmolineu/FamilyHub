import { formatDistanceToNowStrict } from "date-fns";
import { useGoogleHealth } from "@/api";

/** A copy of Google older than this is worth telling the family about. */
const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Phase 4: the calendar reads a copy of Google. This says when that copy is old (Google
 * unreachable for a while, so events added in Google are missing) or when an account
 * must connect again before events can be changed. Otherwise it shows nothing.
 */
export function GoogleStatusBanner() {
  const health = useGoogleHealth().data?.data;
  if (!health?.connected) return null;

  let message: string | null = null;
  if (health.needsReauth || health.writeScopeMissing) {
    message =
      "To change events from here, connect Google again in Family Settings.";
  } else if (
    health.oldestSyncAt &&
    Date.now() - new Date(health.oldestSyncAt).getTime() > STALE_AFTER_MS
  ) {
    message = `Google Calendar can't be reached; the calendar was last updated ${formatDistanceToNowStrict(
      new Date(health.oldestSyncAt),
      { addSuffix: true },
    )}.`;
  }
  if (!message) return null;

  return (
    <div
      role="status"
      className="mx-4 my-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
    >
      {message}
    </div>
  );
}
