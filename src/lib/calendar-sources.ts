import type { CalendarEvent } from "@/lib/types";

/**
 * Where a calendar entry comes from decides whether the family can edit it here.
 * Since Phase 4 the family's events live in Google: editable when a signed-in account
 * may change their calendar (`canEdit`). Birthdays are changed on the person's profile
 * and games through the followed teams.
 */
export function isReadOnlyEvent(
  event: Pick<CalendarEvent, "source" | "canEdit">,
): boolean {
  return (
    (event.source === "GOOGLE" && event.canEdit !== true) ||
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
  event: Pick<CalendarEvent, "source" | "canEdit">,
  _action: "edit" | "delete",
): ReadOnlyNotice | null {
  switch (event.source) {
    case "GOOGLE":
      return event.canEdit === true
        ? null
        : {
            title: "Can't be changed here",
            description:
              "No one signed in to the hub may change this calendar. Edit it in Google Calendar, or connect Google again in Family Settings.",
          };
    case "BIRTHDAY":
      return {
        title: "A birthday from a profile",
        description: "Change or remove it on that person's profile.",
      };
    case "SPORTS":
      return {
        title: "From a team's schedule",
        description: "Hide a team's games in Settings → Weather & Sports.",
      };
    default:
      return null;
  }
}
