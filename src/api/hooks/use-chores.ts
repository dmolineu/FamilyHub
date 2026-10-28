import type { UseQueryOptions } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiException } from "@/api/client";
import { FAMILY_DATA_REFRESH_MS } from "@/api/live-refresh";
import { choreService } from "@/api/services";
import type {
  ApiResponse,
  ChoreActivityEntry,
  ChoreActivityRequest,
  ChoreApprovalRequest,
  ChoreApprovalResult,
  ChoreAssigneeGroup as ChoreAssigneeGroupData,
  ChoreBoardItem,
  ChoreCurrentPeriodState,
  ChorePoints,
  ChoreScope,
  ChoreScopeBoard,
  ChoresBoard,
  ChoreTemplate,
  CreateChoreTemplateRequest,
  ParentPinRequest,
  PendingApprovalCount,
  PendingChoreApproval,
  UpdateChoreTemplateRequest,
  UpdateCurrentPeriodCompletionRequest,
} from "@/lib/types";

export const choreKeys = {
  all: ["chores"] as const,
  board: () => [...choreKeys.all, "board"] as const,
  approvals: () => [...choreKeys.all, "approvals"] as const,
  points: () => [...choreKeys.all, "points"] as const,
};

type BoardScopeKey = "today" | "thisWeek" | "thisMonth";

const STALE_CHORE_PERIOD_MESSAGE =
  "Chore period is stale. Refresh and try again.";

export function isStaleChorePeriodError(error: ApiException): boolean {
  return error.status === 400 && error.message === STALE_CHORE_PERIOD_MESSAGE;
}

function boardKeyForScope(scope: ChoreScope): BoardScopeKey {
  if (scope === "TODAY") return "today";
  if (scope === "THIS_WEEK") return "thisWeek";
  return "thisMonth";
}

function recalculateAssigneeGroup(
  group: ChoreAssigneeGroupData,
): ChoreAssigneeGroupData {
  const total = group.chores.length;
  const completed = group.chores.filter((chore) => chore.completed).length;
  const incompleteChores = group.chores.filter((chore) => !chore.completed);
  const completedChores = group.chores.filter((chore) => chore.completed);

  return {
    ...group,
    chores: [...incompleteChores, ...completedChores],
    summary: {
      total,
      completed,
      remaining: total - completed,
    },
  };
}

function recalculateScope(scope: ChoreScopeBoard): ChoreScopeBoard {
  const assignees = scope.assignees
    .map(recalculateAssigneeGroup)
    .filter((group) => group.summary.total > 0);
  const total = assignees.reduce((sum, group) => sum + group.summary.total, 0);
  const completed = assignees.reduce(
    (sum, group) => sum + group.summary.completed,
    0,
  );

  return {
    ...scope,
    assignees,
    summary: {
      total,
      completed,
      remaining: total - completed,
    },
  };
}

function replaceChoreInScope(
  scope: ChoreScopeBoard,
  updatedChore: ChoreBoardItem,
): ChoreScopeBoard {
  return recalculateScope({
    ...scope,
    assignees: scope.assignees.map((group) => ({
      ...group,
      chores: group.chores.map((chore) =>
        chore.templateId === updatedChore.templateId ? updatedChore : chore,
      ),
    })),
  });
}

function removeTemplateFromScope(
  scope: ChoreScopeBoard,
  templateId: string,
): ChoreScopeBoard {
  return recalculateScope({
    ...scope,
    assignees: scope.assignees.map((group) => ({
      ...group,
      chores: group.chores.filter((chore) => chore.templateId !== templateId),
    })),
  });
}

function applyCurrentPeriodState(
  board: ChoresBoard,
  state: ChoreCurrentPeriodState,
): ChoresBoard {
  const scopeKey = boardKeyForScope(state.scope);

  return {
    ...board,
    [scopeKey]: replaceChoreInScope(board[scopeKey], state.item),
  };
}

function findChoreInScope(
  scope: ChoreScopeBoard,
  templateId: string,
): ChoreBoardItem | undefined {
  for (const group of scope.assignees) {
    const match = group.chores.find((chore) => chore.templateId === templateId);
    if (match) return match;
  }
  return undefined;
}

// Synthesize the completion state locally so the board updates the moment a
// routine is tapped, before the server's canonical response arrives. Reuses the
// same scope recalculation as the success path so counts and ordering stay
// consistent. The request scope tells us which board column owns the routine.
function applyOptimisticCompletion(
  board: ChoresBoard,
  scope: ChoreScope,
  templateId: string,
  completed: boolean,
  completedByMemberId?: string,
): ChoresBoard {
  const scopeKey = boardKeyForScope(scope);
  const existing = findChoreInScope(board[scopeKey], templateId);
  if (!existing) return board;

  const optimisticItem: ChoreBoardItem = {
    ...existing,
    completed,
    completedByMemberId: completed
      ? (completedByMemberId ?? existing.assignedToMemberId ?? null)
      : null,
    // completedAt is an instant, not a calendar date, so toISOString() is
    // correct here; the server overwrites it with the canonical value on success.
    completedAt: completed
      ? (existing.completedAt ?? new Date().toISOString())
      : null,
  };

  return {
    ...board,
    [scopeKey]: replaceChoreInScope(board[scopeKey], optimisticItem),
  };
}

function removeTemplateFromBoard(
  board: ChoresBoard,
  templateId: string,
): ChoresBoard {
  return {
    ...board,
    today: removeTemplateFromScope(board.today, templateId),
    thisWeek: removeTemplateFromScope(board.thisWeek, templateId),
    thisMonth: removeTemplateFromScope(board.thisMonth, templateId),
  };
}

export function useChoresBoard(
  options?: Omit<
    UseQueryOptions<ApiResponse<ChoresBoard>, ApiException>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: choreKeys.board(),
    queryFn: () => choreService.getBoard(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: FAMILY_DATA_REFRESH_MS,
    ...options,
  });
}

interface CreateChoreTemplateCallbacks {
  onSuccess?: (data: ApiResponse<ChoreTemplate[]>) => void;
  onError?: (error: ApiException) => void;
}

export function useCreateChoreTemplate(
  callbacks?: CreateChoreTemplateCallbacks,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateChoreTemplateRequest) =>
      choreService.createTemplates(request),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: choreKeys.board() });
      callbacks?.onSuccess?.(response);
    },
    onError: (error: ApiException) => {
      callbacks?.onError?.(error);
    },
  });
}

interface UpdateChoreTemplateCallbacks {
  onSuccess?: (data: ApiResponse<ChoreTemplate>) => void;
  onError?: (error: ApiException) => void;
}

export function useUpdateChoreTemplate(
  callbacks?: UpdateChoreTemplateCallbacks,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      request,
    }: {
      id: string;
      request: UpdateChoreTemplateRequest;
    }) => choreService.updateTemplate(id, request),
    onSuccess: (response) => {
      if (response.data.archived) {
        queryClient.setQueryData<ApiResponse<ChoresBoard>>(
          choreKeys.board(),
          (current) =>
            current
              ? {
                  ...current,
                  data: removeTemplateFromBoard(current.data, response.data.id),
                }
              : current,
        );
        queryClient.invalidateQueries({
          queryKey: choreKeys.board(),
          refetchType: "none",
        });
      } else {
        queryClient.invalidateQueries({ queryKey: choreKeys.board() });
      }
      callbacks?.onSuccess?.(response);
    },
    onError: (error: ApiException) => {
      callbacks?.onError?.(error);
    },
  });
}

interface CurrentPeriodCompletionCallbacks {
  onSuccess?: (data: ApiResponse<ChoreCurrentPeriodState>) => void;
  onError?: (error: ApiException) => void;
}

export function useCompleteChoreForCurrentPeriod(
  callbacks?: CurrentPeriodCompletionCallbacks,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      request,
    }: {
      templateId: string;
      request: UpdateCurrentPeriodCompletionRequest;
    }) => choreService.completeCurrentPeriod(templateId, request),
    onMutate: async ({ templateId, request }) => {
      await queryClient.cancelQueries({ queryKey: choreKeys.board() });
      const previous = queryClient.getQueryData<ApiResponse<ChoresBoard>>(
        choreKeys.board(),
      );
      queryClient.setQueryData<ApiResponse<ChoresBoard>>(
        choreKeys.board(),
        (current) =>
          current
            ? {
                ...current,
                data: applyOptimisticCompletion(
                  current.data,
                  request.scope,
                  templateId,
                  true,
                  request.completedByMemberId,
                ),
              }
            : current,
      );
      return { previous };
    },
    onSuccess: (response) => {
      queryClient.setQueryData<ApiResponse<ChoresBoard>>(
        choreKeys.board(),
        (current) =>
          current
            ? {
                ...current,
                data: applyCurrentPeriodState(current.data, response.data),
              }
            : current,
      );
      queryClient.invalidateQueries({
        queryKey: choreKeys.board(),
        refetchType: "none",
      });
      // A tick can add to the approvals queue or to someone's points.
      queryClient.invalidateQueries({ queryKey: choreKeys.approvals() });
      queryClient.invalidateQueries({ queryKey: choreKeys.points() });
      callbacks?.onSuccess?.(response);
    },
    onError: (error: ApiException, _variables, context) => {
      // Roll the whole board back to the pre-tap snapshot, then let the
      // stale-period path force a refetch for the canonical server state.
      if (context?.previous) {
        queryClient.setQueryData(choreKeys.board(), context.previous);
      }
      if (isStaleChorePeriodError(error)) {
        queryClient.invalidateQueries({
          queryKey: choreKeys.board(),
          refetchType: "all",
        });
      }
      callbacks?.onError?.(error);
    },
  });
}

export function useUncompleteChoreForCurrentPeriod(
  callbacks?: CurrentPeriodCompletionCallbacks,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      request,
    }: {
      templateId: string;
      request: UpdateCurrentPeriodCompletionRequest;
    }) => choreService.uncompleteCurrentPeriod(templateId, request),
    onMutate: async ({ templateId, request }) => {
      await queryClient.cancelQueries({ queryKey: choreKeys.board() });
      const previous = queryClient.getQueryData<ApiResponse<ChoresBoard>>(
        choreKeys.board(),
      );
      queryClient.setQueryData<ApiResponse<ChoresBoard>>(
        choreKeys.board(),
        (current) =>
          current
            ? {
                ...current,
                data: applyOptimisticCompletion(
                  current.data,
                  request.scope,
                  templateId,
                  false,
                ),
              }
            : current,
      );
      return { previous };
    },
    onSuccess: (response) => {
      queryClient.setQueryData<ApiResponse<ChoresBoard>>(
        choreKeys.board(),
        (current) =>
          current
            ? {
                ...current,
                data: applyCurrentPeriodState(current.data, response.data),
              }
            : current,
      );
      queryClient.invalidateQueries({
        queryKey: choreKeys.board(),
        refetchType: "none",
      });
      // A tick can add to the approvals queue or to someone's points.
      queryClient.invalidateQueries({ queryKey: choreKeys.approvals() });
      queryClient.invalidateQueries({ queryKey: choreKeys.points() });
      callbacks?.onSuccess?.(response);
    },
    onError: (error: ApiException, _variables, context) => {
      // Roll the whole board back to the pre-tap snapshot, then let the
      // stale-period path force a refetch for the canonical server state.
      if (context?.previous) {
        queryClient.setQueryData(choreKeys.board(), context.previous);
      }
      if (isStaleChorePeriodError(error)) {
        queryClient.invalidateQueries({
          queryKey: choreKeys.board(),
          refetchType: "all",
        });
      }
      callbacks?.onError?.(error);
    },
  });
}

/**
 * How many things wait for a parent (kids' chores and asks for rewards), for the
 * "N to approve" button. Only a number: deciding them needs a parent's PIN.
 */
export function usePendingApprovalCount() {
  return useQuery({
    queryKey: choreKeys.approvals(),
    queryFn: () => choreService.getApprovalCount(),
    select: (response: ApiResponse<PendingApprovalCount>) =>
      response.data.count + (response.data.rewardRequests ?? 0),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

/**
 * Opens the waiting chores with a parent's PIN. A mutation, not a query: it
 * carries the PIN, which must never be cached or persisted.
 */
export function useOpenPendingApprovals() {
  return useMutation<
    ApiResponse<PendingChoreApproval[]>,
    ApiException,
    ParentPinRequest
  >({
    mutationFn: (request) => choreService.listPendingApprovals(request),
  });
}

/** Every member's points balance. */
export function useChorePoints() {
  return useQuery({
    queryKey: choreKeys.points(),
    queryFn: () => choreService.getPoints(),
    select: (response: ApiResponse<ChorePoints[]>) => response.data,
    staleTime: 30 * 1000,
  });
}

/** A parent approves or rejects waiting chores; refreshes the board and balances. */
export function useDecideChoreApprovals() {
  const queryClient = useQueryClient();

  return useMutation<
    ApiResponse<ChoreApprovalResult>,
    ApiException,
    ChoreApprovalRequest
  >({
    mutationFn: (request) => choreService.decideApprovals(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.all });
    },
  });
}

/**
 * Opens the chore log. A mutation, not a query: it carries a PIN, which must
 * never be cached or persisted with the query cache.
 */
export function useChoreActivity() {
  return useMutation<
    ApiResponse<ChoreActivityEntry[]>,
    ApiException,
    ChoreActivityRequest
  >({
    mutationFn: (request) => choreService.getActivity(request),
  });
}
