import type { BackupDocument } from "@/lib/types";

export const testBackupDocument: BackupDocument = {
  version: 1,
  exportedAt: "2026-10-23T18:00:00Z",
  family: { name: "Test Family", timezone: "America/Los_Angeles" },
  members: [{ name: "Alice", color: "CORAL" }],
  chores: [],
  lists: { lists: [] },
  recipes: [],
  meals: [],
  events: [],
};
