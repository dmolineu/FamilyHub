import { httpClient } from "@/api/client";
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

/** The rewards shop. Requests that change the catalogue or decide asks carry a parent's PIN in the body. */
export const rewardsService = {
  async getShop(): Promise<ApiResponse<RewardShop>> {
    return httpClient.get<ApiResponse<RewardShop>>("/rewards");
  },

  /** Opens the catalogue for changing; the server checks the parent's PIN. */
  async manage(request: ParentPinRequest): Promise<ApiResponse<RewardShop>> {
    return httpClient.post<ApiResponse<RewardShop>>("/rewards/manage", request);
  },

  async create(request: RewardWriteRequest): Promise<ApiResponse<Reward>> {
    return httpClient.post<ApiResponse<Reward>>("/rewards", request);
  },

  async update(
    id: string,
    request: RewardWriteRequest,
  ): Promise<ApiResponse<Reward>> {
    return httpClient.put<ApiResponse<Reward>>(`/rewards/${id}`, request);
  },

  async archive(id: string, request: ParentPinRequest): Promise<void> {
    await httpClient.post<void>(`/rewards/${id}/archive`, request);
  },

  async ask(
    rewardId: string,
    memberId: string,
  ): Promise<ApiResponse<Redemption>> {
    return httpClient.post<ApiResponse<Redemption>>(
      `/rewards/${rewardId}/redemptions`,
      { memberId },
    );
  },

  async cancel(redemptionId: string, memberId: string): Promise<void> {
    await httpClient.post<void>(`/rewards/redemptions/${redemptionId}/cancel`, {
      memberId,
    });
  },

  async decide(
    request: RedemptionDecisionRequest,
  ): Promise<ApiResponse<RedemptionDecisionResult>> {
    return httpClient.post<ApiResponse<RedemptionDecisionResult>>(
      "/rewards/redemptions/decide",
      request,
    );
  },
};
