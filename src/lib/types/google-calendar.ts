export interface GoogleAuthUrl {
  url: string;
}

export interface GoogleCalendarInfo {
  id: string;
  name: string;
  primary: boolean;
  enabled: boolean;
}

export interface GoogleConnectionStatus {
  connected: boolean;
  calendars: Array<{
    id: string;
    name: string;
    enabled: boolean;
    lastSyncedAt: string | null;
  }>;
}

/** Phase 4: one Google calendar the family's accounts can see (Family Settings). */
export interface GoogleCalendarSetting {
  id: string;
  googleCalendarId: string;
  summary: string;
  color: string | null;
  timeZone: string | null;
  /** Whether the calendar shows it. */
  enabled: boolean;
  /** The best role any signed-in account has: owner, writer, reader, freeBusyReader. */
  accessRole: string | null;
  /** Whether the hub may add and change events on it. */
  writable: boolean;
  /** Whose lanes its events go in when they name no members. */
  laneMemberIds: string[];
  isDefault: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

/** Phase 4: the family's Google calendars and where new events go. */
export interface GoogleCalendarSettings {
  calendars: GoogleCalendarSetting[];
  defaultCalendarId: string | null;
}

/** Phase 4: changes to the family's Google calendars. */
export interface GoogleCalendarSettingsUpdate {
  calendars: Array<{ id: string; enabled: boolean; laneMemberIds: string[] }>;
  defaultCalendarId: string | null;
}

/** Phase 4: whether the calendar is up to date and every account can write. */
export interface GoogleHealth {
  connected: boolean;
  needsReauth: boolean;
  writeScopeMissing: boolean;
  oldestSyncAt: string | null;
  calendars: Array<{
    id: string;
    summary: string;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
  }>;
}
