import type { CalendarEvent } from "@/lib/types";

/**
 * Where a calendar entry comes from decides whether the family can edit it here.
 * Only the family's own events are editable; Google events are edited in Google,
 * birthdays on the person's profile and games through the followed teams.
 */
export function isReadOnlyEvent(event: Pick<CalendarEvent, "source">): boolean {
  return (
    event.source === "GOOGLE" ||
    event.source === "BIRTHDAY" ||
    event.source === "SPORTS"
  );
}

export interface ReadOnlyNotice {
  title: string;
  description: string;
}

/** What to tell someone who tries to edit or delete a read-only entry; null if editable. */
export function readOnlyNotice(
  event: Pick<CalendarEvent, "source">,
  action: "edit" | "delete",
): ReadOnlyNotice | null {
  switch (event.source) {
    case "GOOGLE":
      return {
        title: "Synced from Google Calendar",
        description:
          action === "edit"
            ? "Edit this event in Google Calendar."
            : "Delete this event in Google Calendar.",
      };
    case "BIRTHDAY":
      return {
        title: "A birthday from a profile",
        description: "Change or remove it on that person's profile.",
      };
    case "SPORTS":
      return {
        title: "From a team's schedule",
        description: "Hide a team's games in Family Settings → Teams.",
      };
    default:
      return null;
  }
}
