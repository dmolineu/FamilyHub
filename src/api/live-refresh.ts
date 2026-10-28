/**
 * How often the family's shared data (calendar, chores, lists, meals, members) is
 * fetched again while the app is on screen, so a wall left on one view shows what the
 * phones change without anyone touching it. React Query pauses the timer while the
 * page is hidden, so a phone in a pocket does not keep polling.
 */
export const FAMILY_DATA_REFRESH_MS = 60_000;
