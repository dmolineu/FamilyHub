import { httpClient } from "@/api/client";
import type {
  AddMemberRequest,
  FamilyApiResponse,
  FamilyMutationResponse,
  MemberMutationResponse,
  ParentPinRequest,
  SetMemberPinRequest,
  SetMemberRoleRequest,
  UpdateFamilyRequest,
  UpdateMemberRequest,
} from "@/lib/types";

export const familyService = {
  /**
   * Get the current family data.
   * Returns null in data field if no family exists (triggers onboarding).
   */
  async getFamily(): Promise<FamilyApiResponse> {
    return httpClient.get<FamilyApiResponse>("/family");
  },

  /**
   * Update family properties (e.g., name).
   */
  async updateFamily(
    request: UpdateFamilyRequest,
  ): Promise<FamilyMutationResponse> {
    return httpClient.put<FamilyMutationResponse>("/family", request);
  },

  /**
   * Add a new member to the family.
   */
  async addMember(request: AddMemberRequest): Promise<MemberMutationResponse> {
    return httpClient.post<MemberMutationResponse>("/family/members", request);
  },

  /**
   * Update an existing member.
   */
  async updateMember(
    id: string,
    request: UpdateMemberRequest,
  ): Promise<MemberMutationResponse> {
    return httpClient.put<MemberMutationResponse>(
      `/family/members/${id}`,
      request,
    );
  },

  /** Makes a member a parent or a kid; needs the family password. */
  async setMemberRole(
    id: string,
    request: SetMemberRoleRequest,
  ): Promise<MemberMutationResponse> {
    return httpClient.put<MemberMutationResponse>(
      `/family/members/${id}/role`,
      request,
    );
  },

  /**
   * Checks a parent's face and PIN to unlock Family Settings or Preferences.
   * Answers 204; a wrong PIN is a 403 that counts toward that parent's lockout.
   */
  async unlock(request: ParentPinRequest): Promise<void> {
    return httpClient.post<void>("/family/unlock", request);
  },

  /** Sets a parent's own PIN; needs the family password. Answers 204. */
  async setMemberPin(id: string, request: SetMemberPinRequest): Promise<void> {
    return httpClient.put<void>(`/family/members/${id}/pin`, request);
  },

  /**
   * Remove a member from the family.
   */
  async removeMember(id: string): Promise<void> {
    return httpClient.delete(`/family/members/${id}`);
  },

  /**
   * Delete the entire family (reset).
   */
  async deleteFamily(): Promise<void> {
    return httpClient.delete("/family");
  },
};
