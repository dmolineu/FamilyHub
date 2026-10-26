import type { FamilyColor } from "./family";

export type ChoreCadence = "DAILY" | "WEEKLY" | "MONTHLY";

/** java.time.DayOfWeek names, as the API sends them (ISO order, Monday first). */
export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export const DAYS_OF_WEEK: readonly DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];
export type ChoreScope = "TODAY" | "THIS_WEEK" | "THIS_MONTH";

export interface ChoreBoardItem {
  templateId: string;
  title: string;
  cadence: ChoreCadence;
  /** Weekly chores only: the days it is due; empty means once a week on any day. */
  daysOfWeek?: DayOfWeek[];
  /** Null when the chore is for anyone. */
  assignedToMemberId: string | null;
  completed: boolean;
  completedAt: string | null;
  /** Who got the credit; the assignee unless someone else picked it up. */
  completedByMemberId?: string | null;
  /** PENDING while a kid's chore waits for a parent; null when not done. */
  status?: ChoreCompletionStatus | null;
  /** The chore's points; null for chores made before points existed. */
  points?: number | null;
}

export type ChoreCompletionStatus = "PENDING" | "APPROVED";

export interface ChoreAssigneeGroup {
  /** Null for the "anyone" group of unassigned chores, listed first. */
  member: null | {
    id: string;
    name: string;
    color: FamilyColor;
  };
  summary: {
    total: number;
    completed: number;
    remaining: number;
  };
  chores: ChoreBoardItem[];
}

export interface ChoreScopeBoard {
  scope: ChoreScope;
  periodStartDate: string;
  periodEndDate: string;
  summary: {
    total: number;
    completed: number;
    remaining: number;
  };
  assignees: ChoreAssigneeGroup[];
}

export interface ChoresBoard {
  timezone: string;
  today: ChoreScopeBoard;
  thisWeek: ChoreScopeBoard;
  thisMonth: ChoreScopeBoard;
}

export interface CreateChoreTemplateRequest {
  title: string;
  /** One chore is created per member; empty means a chore for anyone. */
  assignedToMemberIds: string[];
  cadence: ChoreCadence;
  /** Weekly chores only; omitted or empty means once a week on any day. */
  daysOfWeek?: DayOfWeek[];
  activeFrom: string;
  /** 1 to 100; the form always asks for it. */
  points?: number;
}

export interface UpdateChoreTemplateRequest {
  title?: string;
  assignedToMemberId?: string;
  cadence?: ChoreCadence;
  /** Omit to leave unchanged; [] clears the pinned days. */
  daysOfWeek?: DayOfWeek[];
  activeFrom?: string;
  archived?: boolean;
  points?: number;
}

export interface ChoreTemplate {
  id: string;
  title: string;
  assignedToMemberId: string | null;
  cadence: ChoreCadence;
  daysOfWeek: DayOfWeek[];
  activeFrom: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  points?: number | null;
}

export interface UpdateCurrentPeriodCompletionRequest {
  scope: ChoreScope;
  periodStartDate: string;
  /** Required by the API for a chore anyone can do; defaults to the assignee. */
  completedByMemberId?: string;
  /** Unticking a kid's approved chore: the parent taking the points back, and their PIN. */
  approverMemberId?: string;
  pin?: string;
}

export interface ChoreCurrentPeriodState {
  scope: ChoreScope;
  periodStartDate: string;
  periodEndDate: string;
  item: ChoreBoardItem;
}

/** A kid's ticked chore waiting for a parent. */
export interface PendingChoreApproval {
  completionId: string;
  choreTemplateId: string;
  choreTitle: string;
  memberId: string | null;
  memberName: string;
  completedAt: string;
  periodStartDate: string;
  periodEndDate: string;
  /** Null for chores made before points; approving grants none. */
  points: number | null;
}

/** A parent's decision on waiting chores, checked against their own PIN. */
export interface ChoreApprovalRequest {
  approverMemberId: string;
  pin: string;
  approve?: string[];
  reject?: string[];
  reason?: string;
}

/** How many chores the decision changed (stale ones are skipped). */
export interface ChoreApprovalResult {
  approved: number;
  rejected: number;
}

/** A member's points balance. */
export interface ChorePoints {
  memberId: string;
  memberName: string;
  role: "PARENT" | "KID";
  points: number;
}

export type ChoreActivityKind =
  | "COMPLETED"
  | "APPROVED"
  | "REJECTED"
  | "UNCOMPLETED"
  | "REVERSED";

/** One line of the chore log. */
export interface ChoreActivityEntry {
  id: string;
  kind: ChoreActivityKind;
  choreTemplateId: string | null;
  choreTitle: string;
  memberId: string | null;
  memberName: string;
  points: number;
  actorMemberId: string | null;
  actorName: string | null;
  reason: string | null;
  periodStartDate: string | null;
  /** An instant (ISO 8601). */
  occurredAt: string;
}

/** Opens the chore log with a parent's PIN; memberId narrows it to one person. */
export interface ChoreActivityRequest {
  approverMemberId: string;
  pin: string;
  memberId?: string;
}
