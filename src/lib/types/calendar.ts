export interface CalendarEvent {
  id: string | null;
  title: string;
  startTime: string;
  endTime: string;
  date: Date;
  endDate?: Date;
  memberId: string;
  /**
   * Every member the entry belongs to, when that is not just `memberId`: a followed
   * team's game belongs to all its fans. See `@/lib/calendar-members`.
   */
  memberIds?: string[];
  isAllDay: boolean;
  location?: string;
  recurrenceRule?: string;
  recurringEventId?: string;
  isRecurring?: boolean;
  // Google Calendar integration
  // BIRTHDAY and SPORTS are app-side, read-only sources merged in by the client.
  source?: "NATIVE" | "GOOGLE" | "BIRTHDAY" | "SPORTS";
  description?: string;
  htmlLink?: string;
  // Phase 4: Google is the calendar's source of truth. Set on events from the API.
  /** Unique per occurrence in one response; a series' dates share their `recurringEventId`. */
  occurrenceId?: string;
  /** A series date's original start in Google's compact form (20261114T000000Z or 20261114). */
  originalStart?: string;
  /** What the event was read with; sent back with a change so a newer edit is not overwritten. */
  etag?: string;
  calendarId?: string;
  calendarColor?: string;
  /** Whether a signed-in Google account may change it; false while it waits to be copied. */
  canEdit?: boolean;
  /** A series' RRULE/EXDATE/RDATE lines as Google keeps them. */
  recurrence?: string[];
  timeZone?: string;
  googleEventId?: string;
}

/**
 * The API's event (Phase 4): Google's terms. Timed events carry ISO instants; all-day
 * events carry dates with Google's exclusive end. A date of a series is named by its
 * series (`recurringEventId`) and `originalStart`. `calendar.service.ts` turns it into a
 * `CalendarEvent` in the family's zone (`fromWire`).
 */
export interface CalendarEventResponse {
  id: string;
  occurrenceId: string;
  calendarId: string | null;
  calendarColor: string | null;
  googleEventId: string;
  etag: string | null;
  recurringEventId: string | null;
  originalStart: string | null;
  recurring: boolean;
  recurrence: string[] | null;
  title: string;
  description: string | null;
  location: string | null;
  htmlLink: string | null;
  allDay: boolean;
  start: string;
  end: string;
  timeZone: string;
  memberIds: string[];
  status: string;
  canEdit: boolean;
}

/** What the API takes to create or change an event (Phase 4); see `toWire`. */
export interface CalendarWriteBody {
  calendarId: string | null;
  memberIds: string[];
  title: string;
  description: string | null;
  location: string | null;
  allDay: boolean;
  start: string | null;
  end: string | null;
  startDate: string | null;
  endDate: string | null;
  timeZone: string | null;
  /** null keeps a series' lines; an empty list ends the repeating. */
  recurrence: string[] | null;
  etag: string | null;
}

export type CalendarViewType = "daily" | "weekly" | "monthly" | "schedule";

export interface FilterState {
  selectedMembers: string[];
  showAllDayEvents: boolean;
}

// API Request/Response Types
export interface CreateEventRequest {
  /** Phase 4: several members; when absent, `memberId` alone (or an event's members, see toWire). */
  memberIds?: string[];
  /** Phase 4: the calendar to put it on; absent keeps it where it is (or the family's default). */
  calendarId?: string | null;
  /** Phase 4: the etag the event was read with. */
  etag?: string | null;
  title: string;
  startTime: string;
  endTime: string;
  date: string; // ISO string for API transport
  endDate?: string | null;
  memberId: string;
  isAllDay?: boolean;
  location?: string;
  recurrenceRule?: string | null;
  description?: string;
}

export interface UpdateEventRequest {
  /** Phase 4: several members; when absent, `memberId` alone (or an event's members, see toWire). */
  memberIds?: string[];
  /** Phase 4: the calendar to put it on; absent keeps it where it is (or the family's default). */
  calendarId?: string | null;
  /** Phase 4: the etag the event was read with. */
  etag?: string | null;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  endDate?: string | null;
  memberId: string;
  isAllDay?: boolean;
  location?: string;
  recurrenceRule?: string | null;
  description?: string;
}

export interface GetEventsParams {
  startDate: string;
  endDate: string;
  memberId?: string;
}

// Re-export unified response type for backwards compatibility
export type { ApiResponse } from "./api-response";
