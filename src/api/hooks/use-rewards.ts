import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiException } from "@/api/client";
import { rewardsService } from "@/api/services/rewards.service";
import type {
  ApiResponse,
  ParentPinRequest,
  Redemption,
  RedemptionDecisionRequest,
  RedemptionDecisionResult,
  Reward,
  RewardShop,
  RewardWriteRequest,
} from "@/lib/types";
import { choreKeys } from "./use-chores";

export const rewardKeys = {
  all: ["rewards"] as const,
  shop: () => [...rewardKeys.all, "shop"] as const,
};

/** What is on offer and which asks are waiting; needs no PIN. */
export function useRewardShop() {
  return useQuery({
    queryKey: rewardKeys.shop(),
    queryFn: () => rewardsService.getShop(),
    select: (response: ApiResponse<RewardShop>) => response.data,
    staleTime: 30 * 1000,
  });
}

/**
 * Opens the catalogue for changing with a parent's PIN. A mutation, not a query: it
 * carries the PIN, which must never be cached or persisted.
 */
export function useOpenRewardManagement() {
  return useMutation<ApiResponse<RewardShop>, ApiException, ParentPinRequest>({
    mutationFn: (request) => rewardsService.manage(request),
  });
}

/** Adds a reward with a parent's PIN. */
export function useCreateReward() {
  const queryClient = useQueryClient();
  return useMutation<ApiResponse<Reward>, ApiException, RewardWriteRequest>({
    mutationFn: (request) => rewardsService.create(request),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: rewardKeys.all }),
  });
}

/** Changes a reward with a parent's PIN. */
export function useUpdateReward() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiResponse<Reward>,
    ApiException,
    { id: string } & RewardWriteRequest
  >({
    mutationFn: ({ id, ...request }) => rewardsService.update(id, request),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: rewardKeys.all }),
  });
}

/** Takes a reward out of the shop with a parent's PIN. */
export function useArchiveReward() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiException, { id: string } & ParentPinRequest>({
    mutationFn: ({ id, ...request }) => rewardsService.archive(id, request),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: rewardKeys.all }),
  });
}

/** A member asks for a reward; refreshes the shop and the approvals badge. */
export function useAskForReward() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiResponse<Redemption>,
    ApiException,
    { rewardId: string; memberId: string }
  >({
    mutationFn: ({ rewardId, memberId }) =>
      rewardsService.ask(rewardId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardKeys.all });
      queryClient.invalidateQueries({ queryKey: choreKeys.approvals() });
    },
  });
}

/** The member who asked takes it back. */
export function useCancelRedemption() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    ApiException,
    { redemptionId: string; memberId: string }
  >({
    mutationFn: ({ redemptionId, memberId }) =>
      rewardsService.cancel(redemptionId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardKeys.all });
      queryClient.invalidateQueries({ queryKey: choreKeys.approvals() });
    },
  });
}

/** A parent approves or declines waiting asks; refreshes the shop and every balance. */
export function useDecideRedemptions() {
  const queryClient = useQueryClient();
  return useMutation<
    ApiResponse<RedemptionDecisionResult>,
    ApiException,
    RedemptionDecisionRequest
  >({
    mutationFn: (request) => rewardsService.decide(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardKeys.all });
      queryClient.invalidateQueries({ queryKey: choreKeys.all });
    },
  });
}
