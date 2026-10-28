import {
  AlertCircle,
  ClipboardList,
  Gift,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import {
  type ApiException,
  isStaleChorePeriodError,
  useChorePoints,
  useChoresBoard,
  useCompleteChoreForCurrentPeriod,
  useCreateChoreTemplate,
  useFamilyMemberMap,
  usePendingApprovalCount,
  useUncompleteChoreForCurrentPeriod,
  useUpdateChoreTemplate,
} from "@/api";
import { ChoreApprovalsSheet } from "@/components/chores/chore-approvals-sheet";
import { ChoreFormSheet } from "@/components/chores/chore-form-sheet";
import { ChoreLogSheet } from "@/components/chores/chore-log-sheet";
import { ChoresBoardLarge } from "@/components/chores/chores-board-large";
import { ChoreScopeColumn } from "@/components/chores/chores-scope-column";
import {
  type ChoreScopeKey,
  ChoreScopeSwitcher,
} from "@/components/chores/chores-scope-switcher";
import { ParentPinPad } from "@/components/chores/parent-pin-pad";
import { RewardsSheet } from "@/components/chores/rewards-sheet";
import {
  FloatingActionButton,
  MOBILE_FAB_SCROLL_PADDING,
  OfflineUnavailable,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { MobileSheet } from "@/components/ui/mobile-sheet";
import { toast } from "@/components/ui/toaster";
import { useIsLargeScreen, useIsMobile } from "@/hooks";
import type { ChoreBoardItem, ChoreScopeBoard, ChoresBoard } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ChoreFormData } from "@/lib/validations";

function hasAnyRoutines(board: ChoresBoard): boolean {
  return [board.today, board.thisWeek, board.thisMonth].some(
    (scope) => scope.summary.total > 0,
  );
}

function selectedScope(board: ChoresBoard, scope: ChoreScopeKey) {
  if (scope === "today") return board.today;
  if (scope === "thisWeek") return board.thisWeek;
  return board.thisMonth;
}

function showStalePeriodRecovery(error: ApiException) {
  if (!isStaleChorePeriodError(error)) return;

  toast({
    title: "Chores were out of date",
    description: "Refreshing the board. Try that again.",
    variant: "destructive",
  });
}

/** Kids' points balances; nothing at all when the family has no kids yet. */
function KidsPointsStrip() {
  const points = useChorePoints();
  const kids = (points.data ?? []).filter((p) => p.role === "KID");
  if (kids.length === 0) return null;
  return (
    <section aria-label="Kids' points" className="flex flex-wrap gap-2">
      {kids.map((kid) => (
        <div
          key={kid.memberId}
          className="flex items-baseline gap-2 rounded-full border border-border bg-card px-3 py-1.5"
        >
          <span className="text-sm font-semibold text-foreground">
            {kid.memberName}
          </span>
          <span className="text-sm text-muted-foreground">
            {kid.points} point{kid.points === 1 ? "" : "s"}
          </span>
        </div>
      ))}
    </section>
  );
}

interface PinUntick {
  scope: ChoreScopeBoard;
  chore: ChoreBoardItem;
}

export function ChoresView() {
  const isMobile = useIsMobile();
  const isLargeScreen = useIsLargeScreen();
  const [selectedScopeKey, setSelectedScopeKey] =
    useState<ChoreScopeKey>("today");
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [isApprovalsOpen, setApprovalsOpen] = useState(false);
  const [isLogOpen, setLogOpen] = useState(false);
  const [isRewardsOpen, setRewardsOpen] = useState(false);
  const [pinUntick, setPinUntick] = useState<PinUntick | null>(null);
  const memberMap = useFamilyMemberMap();
  const pendingCount = usePendingApprovalCount().data ?? 0;
  const { data, isError, isLoading } = useChoresBoard();
  const createTemplate = useCreateChoreTemplate({
    onSuccess: () => setCreateOpen(false),
  });
  const updateTemplate = useUpdateChoreTemplate();
  const completeCurrentPeriod = useCompleteChoreForCurrentPeriod({
    onError: showStalePeriodRecovery,
  });
  const uncompleteCurrentPeriod = useUncompleteChoreForCurrentPeriod({
    onError: showStalePeriodRecovery,
  });
  const board = data?.data;
  const hasRoutines = board ? hasAnyRoutines(board) : false;
  const visibleScopes = board
    ? isMobile
      ? [selectedScope(board, selectedScopeKey)]
      : [board.today, board.thisWeek, board.thisMonth]
    : [];
  const activeFrom = board?.today.periodStartDate;
  const canCreate = Boolean(activeFrom) && !isLoading && !isError;

  const handleCreate = (values: ChoreFormData) => {
    if (!activeFrom) return;

    createTemplate.mutate({
      title: values.title,
      assignedToMemberIds: values.assignedToMemberIds,
      cadence: values.cadence,
      daysOfWeek: values.daysOfWeek,
      activeFrom,
      points: values.points,
    });
  };

  const handleArchive = (_scope: ChoreScopeBoard, chore: ChoreBoardItem) => {
    updateTemplate.mutate({
      id: chore.templateId,
      request: { archived: true },
    });
  };

  const handleComplete = (
    scope: ChoreScopeBoard,
    chore: ChoreBoardItem,
    completedByMemberId?: string,
  ) => {
    completeCurrentPeriod.mutate({
      templateId: chore.templateId,
      request: {
        scope: scope.scope,
        periodStartDate: scope.periodStartDate,
        ...(completedByMemberId ? { completedByMemberId } : {}),
      },
    });
  };

  const handleUncomplete = (scope: ChoreScopeBoard, chore: ChoreBoardItem) => {
    // Taking back a kid's approved points needs a parent, so a kid cannot undo
    // a parent's decision. Pending ticks and parents' own chores untick freely.
    const creditedId = chore.completedByMemberId ?? chore.assignedToMemberId;
    const credited = creditedId ? memberMap.get(creditedId) : undefined;
    if (chore.status === "APPROVED" && credited?.role === "KID") {
      setPinUntick({ scope, chore });
      return;
    }
    uncompleteCurrentPeriod.mutate({
      templateId: chore.templateId,
      request: {
        scope: scope.scope,
        periodStartDate: scope.periodStartDate,
      },
    });
  };

  return (
    <>
      <div
        className={cn(
          "flex-1 p-4 sm:p-6",
          isLargeScreen ? "flex min-h-0 flex-col" : "overflow-y-auto",
        )}
        style={{
          paddingBottom: isMobile ? MOBILE_FAB_SCROLL_PADDING : undefined,
        }}
      >
        <div
          className={cn(
            "mx-auto",
            isLargeScreen
              ? "flex min-h-0 w-full max-w-[1600px] flex-1 flex-col"
              : "max-w-6xl",
          )}
        >
          <div className="mb-6 flex shrink-0 items-start justify-between gap-3">
            <div className="space-y-3">
              {!isMobile && (
                <h1 className="text-[24px] leading-8 font-semibold text-foreground">
                  Chores
                </h1>
              )}
              {isMobile && (
                <ChoreScopeSwitcher
                  value={selectedScopeKey}
                  onChange={setSelectedScopeKey}
                />
              )}
            </div>
            {!isMobile && (
              <Button
                type="button"
                aria-label="Add recurring chore"
                size="icon"
                disabled={!canCreate}
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-5 w-5" />
              </Button>
            )}
          </div>

          {board && (
            <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
              <KidsPointsStrip />
              <div className="ml-auto flex flex-wrap gap-2">
                {pendingCount > 0 && (
                  <Button
                    type="button"
                    className="min-h-11"
                    onClick={() => setApprovalsOpen(true)}
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {pendingCount} to approve
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setRewardsOpen(true)}
                >
                  <Gift className="h-4 w-4" aria-hidden="true" />
                  Rewards
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setLogOpen(true)}
                >
                  <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  Chore log
                </Button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading chores...
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              Could not load chores. Try again in a moment.
            </div>
          )}

          {/* Offline + never loaded: paused query leaves no data and no error. */}
          {!isLoading && !isError && !board && (
            <OfflineUnavailable label="chores" />
          )}

          {!isLoading && !isError && board && !hasRoutines && (
            <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center">
              <h2 className="text-lg font-semibold text-foreground">
                No recurring chores yet
              </h2>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                Add a daily, weekly, or monthly routine to get started.
              </p>
            </div>
          )}

          {!isLoading &&
            !isError &&
            board &&
            hasRoutines &&
            (isLargeScreen ? (
              <ChoresBoardLarge
                today={board.today}
                thisWeek={board.thisWeek}
                thisMonth={board.thisMonth}
                onArchive={handleArchive}
                onComplete={handleComplete}
                onUncomplete={handleUncomplete}
              />
            ) : (
              <div className={cn("grid gap-4", !isMobile && "lg:grid-cols-3")}>
                {visibleScopes.map((scope) => (
                  <ChoreScopeColumn
                    key={scope.scope}
                    scope={scope}
                    showHeading={!isMobile}
                    onArchive={handleArchive}
                    onComplete={handleComplete}
                    onUncomplete={handleUncomplete}
                  />
                ))}
              </div>
            ))}
        </div>
      </div>

      <ChoreApprovalsSheet
        isOpen={isApprovalsOpen}
        onClose={() => setApprovalsOpen(false)}
      />
      <ChoreLogSheet isOpen={isLogOpen} onClose={() => setLogOpen(false)} />
      <RewardsSheet
        isOpen={isRewardsOpen}
        onClose={() => setRewardsOpen(false)}
      />
      <MobileSheet
        isOpen={pinUntick !== null}
        onClose={() => setPinUntick(null)}
        title="Take back points"
        initialHeight="half"
      >
        {pinUntick && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              {pinUntick.chore.title} was already approved. Unticking it takes
              its points back.
            </p>
            <ParentPinPad
              prompt="Who is taking the points back?"
              submitLabel="Untick"
              onSubmit={(approverMemberId, pin) =>
                uncompleteCurrentPeriod
                  .mutateAsync({
                    templateId: pinUntick.chore.templateId,
                    request: {
                      scope: pinUntick.scope.scope,
                      periodStartDate: pinUntick.scope.periodStartDate,
                      approverMemberId,
                      pin,
                    },
                  })
                  .then(() => setPinUntick(null))
              }
            />
          </div>
        )}
      </MobileSheet>

      <ChoreFormSheet
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        isPending={createTemplate.isPending}
        onSubmit={handleCreate}
      />

      {isMobile && (
        <FloatingActionButton
          label="Add recurring chore"
          disabled={!canCreate}
          onClick={() => setCreateOpen(true)}
        />
      )}
    </>
  );
}
