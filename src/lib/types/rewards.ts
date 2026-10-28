/** Something in the family's rewards shop, priced in chore points. */
export interface Reward {
  id: string;
  title: string;
  description: string | null;
  points: number;
}

export type RedemptionStatus =
  | "PENDING"
  | "APPROVED"
  | "DECLINED"
  | "CANCELLED";

/** A member's ask for a reward; its points are held while it waits. */
export interface Redemption {
  id: string;
  rewardId: string | null;
  rewardTitle: string;
  memberId: string;
  memberName: string;
  points: number;
  status: RedemptionStatus;
  requestedAt: string;
}

/** The shop as anyone sees it: what is on offer and which asks are waiting. */
export interface RewardShop {
  rewards: Reward[];
  waiting: Redemption[];
}

/** Adding or changing a reward, with a parent's own PIN. */
export interface RewardWriteRequest {
  approverMemberId: string;
  pin: string;
  title: string;
  description?: string | null;
  points: number;
}

/** A parent's decision on waiting asks, with their own PIN. */
export interface RedemptionDecisionRequest {
  approverMemberId: string;
  pin: string;
  approve?: string[];
  decline?: string[];
  reason?: string;
}

export interface RedemptionDecisionResult {
  approved: number;
  declined: number;
}
