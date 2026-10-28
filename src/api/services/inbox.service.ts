import { httpClient } from "@/api/client";
import type {
  ApiResponse,
  InboxApproveRequest,
  InboxImport,
  InboxSender,
  InboxSenderRequest,
  InboxStatus,
  ParentPinRequest,
} from "@/lib/types";

export const inboxService = {
  /** The inbox's address and state, who may send, and the latest imports. */
  async status(): Promise<ApiResponse<InboxStatus>> {
    return httpClient.get<ApiResponse<InboxStatus>>("/inbox");
  },

  /** Puts a proposed event on the calendar, with any corrections (parent PIN). */
  async approve(
    id: string,
    request: InboxApproveRequest,
  ): Promise<ApiResponse<InboxImport>> {
    return httpClient.post<ApiResponse<InboxImport>>(
      `/inbox/imports/${id}/approve`,
      request,
    );
  },

  /** Turns a proposed event down (parent PIN). */
  async reject(
    id: string,
    request: ParentPinRequest,
  ): Promise<ApiResponse<InboxImport>> {
    return httpClient.post<ApiResponse<InboxImport>>(
      `/inbox/imports/${id}/reject`,
      request,
    );
  },

  /** Takes off something the inbox added (parent PIN). */
  async undo(
    id: string,
    request: ParentPinRequest,
  ): Promise<ApiResponse<InboxImport>> {
    return httpClient.post<ApiResponse<InboxImport>>(
      `/inbox/imports/${id}/undo`,
      request,
    );
  },

  /** Lets another address send to the inbox (parent PIN). */
  async addSender(
    request: InboxSenderRequest,
  ): Promise<ApiResponse<InboxSender>> {
    return httpClient.post<ApiResponse<InboxSender>>("/inbox/senders", request);
  },

  /** Stops an added address from sending (parent PIN). */
  async removeSender(id: string, request: ParentPinRequest): Promise<void> {
    await httpClient.post<void>(`/inbox/senders/${id}/remove`, request);
  },
};
