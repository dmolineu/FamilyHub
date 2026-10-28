import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiException } from "@/api/client";
import { FAMILY_DATA_REFRESH_MS } from "@/api/live-refresh";
import { inboxService } from "@/api/services";
import type {
  ApiResponse,
  InboxApproveRequest,
  InboxImport,
  InboxSender,
  InboxSenderRequest,
  InboxStatus,
  ParentPinRequest,
} from "@/lib/types";
import { calendarKeys } from "./use-calendar";
import { photoKeys } from "./use-photos";
import { recipesKeys } from "./use-recipes";

export const inboxKeys = {
  all: ["inbox"] as const,
  status: () => [...inboxKeys.all, "status"] as const,
};

/** The family inbox, refreshed like the rest of the family's data. */
export function useInbox(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: inboxKeys.status(),
    queryFn: () => inboxService.status(),
    select: (response: ApiResponse<InboxStatus>) => response.data,
    enabled: options?.enabled ?? true,
    refetchInterval: FAMILY_DATA_REFRESH_MS,
  });
}

/** After a decision: the inbox, and whatever it added to or took from. */
function useRefreshAfterDecision() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: inboxKeys.all });
    queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
    queryClient.invalidateQueries({ queryKey: recipesKeys.all });
    queryClient.invalidateQueries({ queryKey: photoKeys.all });
  };
}

export function useApproveInboxImport() {
  const refresh = useRefreshAfterDecision();
  return useMutation<
    ApiResponse<InboxImport>,
    ApiException,
    { id: string; request: InboxApproveRequest }
  >({
    mutationFn: ({ id, request }) => inboxService.approve(id, request),
    onSuccess: refresh,
  });
}

export function useRejectInboxImport() {
  const refresh = useRefreshAfterDecision();
  return useMutation<
    ApiResponse<InboxImport>,
    ApiException,
    { id: string; request: ParentPinRequest }
  >({
    mutationFn: ({ id, request }) => inboxService.reject(id, request),
    onSuccess: refresh,
  });
}

export function useUndoInboxImport() {
  const refresh = useRefreshAfterDecision();
  return useMutation<
    ApiResponse<InboxImport>,
    ApiException,
    { id: string; request: ParentPinRequest }
  >({
    mutationFn: ({ id, request }) => inboxService.undo(id, request),
    onSuccess: refresh,
  });
}

export function useAddInboxSender() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiResponse<InboxSender>,
    ApiException,
    InboxSenderRequest
  >({
    mutationFn: (request) => inboxService.addSender(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
  });
}

export function useRemoveInboxSender() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    ApiException,
    { id: string; request: ParentPinRequest }
  >({
    mutationFn: ({ id, request }) => inboxService.removeSender(id, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
  });
}
