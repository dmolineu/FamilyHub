import type { ParentPinRequest } from "./chores";

/** What a message to the family inbox added or proposed. */
export type InboxImportKind = "PHOTO" | "EVENT" | "RECIPE";

/** Where it stands: added, waiting for a parent, turned down, or taken off again. */
export type InboxImportStatus = "ADDED" | "PENDING" | "REJECTED" | "UNDONE";

/** An event the inbox read but did not add, for a parent to check. */
export interface InboxProposal {
  title: string;
  /** yyyy-MM-dd, or null when the reader could not tell. */
  date: string | null;
  endDate: string;
  allDay: boolean;
  /** Like "9:00 AM"; "" when unknown or all day. */
  startTime: string;
  endTime: string;
  location: string;
  people: string[];
  /** What was unclear about it. */
  uncertainty: string;
}

export interface InboxImport {
  id: string;
  kind: InboxImportKind;
  status: InboxImportStatus;
  title: string;
  confidence: string | null;
  createdAt: string;
  decidedAt: string | null;
  /** Who sent the message it came from. */
  sender: string | null;
  subject: string | null;
  /** Present while an event waits for a parent. */
  proposal: InboxProposal | null;
  calendarEventId: string | null;
  recipeId: string | null;
  photoId: string | null;
}

/** An address, beyond the members' own, allowed to send to the inbox. */
export interface InboxSender {
  id: string;
  address: string;
}

/** The family inbox at a glance. */
export interface InboxStatus {
  /** Whether the server has a mailbox to read. */
  configured: boolean;
  /** The address the family sends to. */
  address: string | null;
  /** Whether flyers and recipes can be read (photos work without it). */
  readerAvailable: boolean;
  lastReadAt: string | null;
  lastError: string | null;
  memberAddresses: string[];
  extraSenders: InboxSender[];
  /** Events waiting for a parent. */
  waiting: number;
  imports: InboxImport[];
}

/** Approving a proposed event; fields left out keep what the inbox read. */
export interface InboxApproveRequest extends ParentPinRequest {
  title?: string;
  date?: string;
  endDate?: string;
  allDay?: boolean;
  startTime?: string;
  endTime?: string;
  memberId?: string;
}

export interface InboxSenderRequest extends ParentPinRequest {
  address: string;
}
