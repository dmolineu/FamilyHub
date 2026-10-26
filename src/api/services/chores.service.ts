import { httpClient } from "@/api/client";
import type {
  ApiResponse,
  ChoreActivityEntry,
  ChoreActivityRequest,
  ChoreApprovalRequest,
  ChoreApprovalResult,
  ChoreCurrentPeriodState,
  ChorePoints,
  ChoresBoard,
  ChoreTemplate,
  CreateChoreTemplateRequest,
  ParentPinRequest,
  PendingApprovalCount,
  PendingChoreApproval,
  UpdateChoreTemplateRequest,
  UpdateCurrentPeriodCompletionRequest,
} from "@/lib/types";

export const choreService = {
  async getBoard(): Promise<ApiResponse<ChoresBoard>> {
    return httpClient.get<ApiResponse<ChoresBoard>>("/chores/board");
  },

  /** Creates one template per selected member (or one for anyone) in a single call. */
  async createTemplates(
    request: CreateChoreTemplateRequest,
  ): Promise<ApiResponse<ChoreTemplate[]>> {
    return httpClient.post<ApiResponse<ChoreTemplate[]>>(
      "/chores/templates",
      request,
    );
  },

  async updateTemplate(
    id: string,
    request: UpdateChoreTemplateRequest,
  ): Promise<ApiResponse<ChoreTemplate>> {
    return httpClient.patch<ApiResponse<ChoreTemplate>>(
      `/chores/templates/${id}`,
      request,
    );
  },

  async completeCurrentPeriod(
    id: string,
    request: UpdateCurrentPeriodCompletionRequest,
  ): Promise<ApiResponse<ChoreCurrentPeriodState>> {
    return httpClient.put<ApiResponse<ChoreCurrentPeriodState>>(
      `/chores/templates/${id}/current-period-completion`,
      request,
    );
  },

  async uncompleteCurrentPeriod(
    id: string,
    request: UpdateCurrentPeriodCompletionRequest,
  ): Promise<ApiResponse<ChoreCurrentPeriodState>> {
    return httpClient.delete<ApiResponse<ChoreCurrentPeriodState>>(
      `/chores/templates/${id}/current-period-completion`,
      request,
    );
  },

  /** How many kids' chores wait (no details, no PIN). */
  async getApprovalCount(): Promise<ApiResponse<PendingApprovalCount>> {
    return httpClient.get<ApiResponse<PendingApprovalCount>>(
      "/chores/approvals/count",
    );
  },

  /** The waiting chores themselves, opened with a parent's PIN. */
  async listPendingApprovals(
    request: ParentPinRequest,
  ): Promise<ApiResponse<PendingChoreApproval[]>> {
    return httpClient.post<ApiResponse<PendingChoreApproval[]>>(
      "/chores/approvals/pending",
      request,
    );
  },

  /** A parent approves and rejects waiting chores with their own PIN. */
  async decideApprovals(
    request: ChoreApprovalRequest,
  ): Promise<ApiResponse<ChoreApprovalResult>> {
    return httpClient.post<ApiResponse<ChoreApprovalResult>>(
      "/chores/approvals",
      request,
    );
  },

  /** Every member's points balance. */
  async getPoints(): Promise<ApiResponse<ChorePoints[]>> {
    return httpClient.get<ApiResponse<ChorePoints[]>>("/chores/points");
  },

  /** The chore log; a POST so the PIN never sits in a URL. */
  async getActivity(
    request: ChoreActivityRequest,
  ): Promise<ApiResponse<ChoreActivityEntry[]>> {
    return httpClient.post<ApiResponse<ChoreActivityEntry[]>>(
      "/chores/activity",
      request,
    );
  },
};
