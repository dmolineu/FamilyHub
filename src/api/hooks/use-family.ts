import type { UseQueryOptions } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ApiException } from "@/api/client";
import {
  familyKeys,
  readFamilyFromStorage,
  writeFamilyToStorage,
} from "@/api/hooks/family-storage";
import { FAMILY_DATA_REFRESH_MS } from "@/api/live-refresh";
import { familyService } from "@/api/services";
import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/constants";
import { assertOnlineForWrite } from "@/lib/offline/read-only-guard";
import type {
  AddMemberRequest,
  FamilyApiResponse,
  FamilyColor,
  FamilyData,
  FamilyMember,
  FamilyMutationResponse,
  MemberMutationResponse,
  SetMemberPinRequest,
  SetMemberRoleRequest,
  UpdateFamilyRequest,
  UpdateMemberRequest,
} from "@/lib/types";
import { familyColors } from "@/lib/types";
import { useIsAuthenticated } from "@/stores";

// ============================================================================
// Query Keys & localStorage Helpers (re-exported from family-storage.ts)
// ============================================================================

// Defined in a React-free module so family-store.ts can import them without
// creating an import cycle through @/stores. See family-storage.ts.
export {
  familyKeys,
  readFamilyFromStorage,
  syncFamilyFromStorage,
} from "@/api/hooks/family-storage";

// ============================================================================
// Optimistic Member Helpers
// ============================================================================

/**
 * Prefix for the client-side id assigned to a member that has been added
 * optimistically but whose create request has not yet been confirmed by the
 * server. Once the POST resolves, `useAddMember` swaps this for the real id.
 */
export const TEMP_MEMBER_ID_PREFIX = "temp-";

/**
 * Whether a member id is an unconfirmed optimistic id (see
 * {@link TEMP_MEMBER_ID_PREFIX}). The server does not know about such members
 * yet, so update/remove requests against them would 404 — callers should wait
 * for the add to confirm before mutating them.
 */
export function isTempMemberId(id: string): boolean {
  return id.startsWith(TEMP_MEMBER_ID_PREFIX);
}

/** The stored token, or null; read here to avoid an import cycle with use-auth. */
function readAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

// ============================================================================
// Main Query
// ============================================================================

/**
 * Fetch family data with localStorage seeding for instant startup.
 */
export function useFamily(
  options?: Omit<
    UseQueryOptions<FamilyApiResponse, ApiException>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: familyKeys.family(),
    queryFn: async () => {
      const token = readAuthToken();
      const response = await familyService.getFamily();
      // Keep this device's startup copy current with what the server says,
      // including changes made on other devices. Only while the session that
      // asked is still signed in: an answer arriving after Sign Out (or after
      // another family signed in) must not be written back.
      if (
        response.data !== undefined &&
        token !== null &&
        readAuthToken() === token
      ) {
        writeFamilyToStorage(response.data);
      }
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: FAMILY_DATA_REFRESH_MS,
    // Seed from localStorage for instant startup
    initialData: () => {
      const cached = readFamilyFromStorage();
      if (cached) {
        return { data: cached };
      }
      return undefined;
    },
    // Mark initialData as potentially stale to trigger background refetch
    initialDataUpdatedAt: 0,
    ...options,
  });
}

// ============================================================================
// Derived Selectors (read from query cache)
// ============================================================================

/**
 * Get family data (null if not initialized).
 */
export function useFamilyData(): FamilyData | null {
  const { data } = useFamily();
  return data?.data ?? null;
}

/**
 * Get all family members.
 */
export function useFamilyMembers(): FamilyMember[] {
  const { data } = useFamily();
  return data?.data?.members ?? [];
}

/**
 * Get family name.
 */
export function useFamilyName(): string {
  const { data } = useFamily();
  return data?.data?.name ?? "";
}

/**
 * Check if setup is complete.
 * Derived: true when family data exists and has at least one member.
 *
 * Auth guard: Unlike other derived selectors (useFamilyName, useFamilyMembers, etc.)
 * which are only rendered inside authenticated routes, this hook is called at the
 * top-level routing layer (App.tsx) before the auth guard. Without the `enabled`
 * check, useFamily() would fire GET /family on every page load — returning 401
 * for unauthenticated users and triggering an infinite reload loop.
 */
export function useSetupComplete(): boolean {
  const isAuthenticated = useIsAuthenticated();
  const { data, isFetched } = useFamily({ enabled: isAuthenticated });
  if (!isFetched) return false;
  const family = data?.data;
  return family != null && family.members.length > 0;
}

/**
 * Check if family data is loading (for initial load states).
 */
export function useFamilyLoading(): boolean {
  const { isLoading, isFetching, data } = useFamily();
  // Loading if we don't have data and are fetching
  return isLoading || (isFetching && !data);
}

/**
 * Get a family member by ID.
 */
export function useFamilyMemberById(id: string): FamilyMember | undefined {
  const members = useFamilyMembers();
  return members.find((m) => m.id === id);
}

/**
 * Get the family member map for O(1) lookups.
 * Memoized to prevent creating new Map on every render.
 */
export function useFamilyMemberMap(): Map<string, FamilyMember> {
  const members = useFamilyMembers();
  return useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
}

/**
 * Get unused colors (colors not assigned to any member).
 * Memoized to prevent creating new array on every render.
 */
export function useUnusedColors(): FamilyColor[] {
  const members = useFamilyMembers();
  return useMemo(() => {
    const usedColors = new Set(members.map((m) => m.color));
    return familyColors.filter((c) => !usedColors.has(c));
  }, [members]);
}

// ============================================================================
// Mutations
// ============================================================================

interface UpdateFamilyCallbacks {
  onSuccess?: (data: FamilyMutationResponse) => void;
  onError?: (error: ApiException) => void;
}

/**
 * Update family properties (e.g., name).
 */
export function useUpdateFamily(callbacks?: UpdateFamilyCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateFamilyRequest) =>
      familyService.updateFamily(request),
    // Optimistic update
    onMutate: async (request) => {
      // Read-only offline: reject before any optimistic cache change.
      assertOnlineForWrite();
      await queryClient.cancelQueries({ queryKey: familyKeys.family() });

      const previousData = queryClient.getQueryData<FamilyApiResponse>(
        familyKeys.family(),
      );

      if (previousData?.data) {
        // Partial update: fields left undefined are unchanged (BE semantics).
        const optimisticFamily: FamilyData = {
          ...previousData.data,
          ...(request.name !== undefined && { name: request.name }),
          ...(request.timezone !== undefined && {
            timezone: request.timezone,
          }),
          // The server resolves the typed text to a place name; until it
          // answers, show what was typed (or clear it).
          ...(request.weatherLocation !== undefined && {
            weatherLocation: request.weatherLocation.trim() || null,
          }),
        };
        queryClient.setQueryData<FamilyApiResponse>(familyKeys.family(), {
          ...previousData,
          data: optimisticFamily,
        });
      }

      return { previousData };
    },
    onError: (error: ApiException, _request, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(familyKeys.family(), context.previousData);
      }
      callbacks?.onError?.(error);
    },
    onSuccess: (response) => {
      // Update with server response
      queryClient.setQueryData<FamilyApiResponse>(familyKeys.family(), {
        data: response.data,
      });
      // Write-through to localStorage
      writeFamilyToStorage(response.data);
      callbacks?.onSuccess?.(response);
    },
  });
}

interface AddMemberCallbacks {
  onSuccess?: (data: MemberMutationResponse) => void;
  onError?: (error: ApiException) => void;
}

/**
 * Add a new member to the family.
 */
export function useAddMember(callbacks?: AddMemberCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: AddMemberRequest) => familyService.addMember(request),
    // Optimistic update
    onMutate: async (request) => {
      // Read-only offline: reject before any optimistic cache change.
      assertOnlineForWrite();
      await queryClient.cancelQueries({ queryKey: familyKeys.family() });

      const previousData = queryClient.getQueryData<FamilyApiResponse>(
        familyKeys.family(),
      );

      if (previousData?.data) {
        const optimisticMember: FamilyMember = {
          // Temporary id, replaced with the real one on success.
          id: `${TEMP_MEMBER_ID_PREFIX}${Date.now()}`,
          ...request,
        };
        const optimisticFamily: FamilyData = {
          ...previousData.data,
          members: [...previousData.data.members, optimisticMember],
        };
        queryClient.setQueryData<FamilyApiResponse>(familyKeys.family(), {
          ...previousData,
          data: optimisticFamily,
        });
      }

      return { previousData };
    },
    onError: (error: ApiException, _request, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(familyKeys.family(), context.previousData);
      }
      callbacks?.onError?.(error);
    },
    onSuccess: (response) => {
      // Replace temp member with server response (which has real ID)
      const currentData = queryClient.getQueryData<FamilyApiResponse>(
        familyKeys.family(),
      );
      if (currentData?.data) {
        const updatedFamily: FamilyData = {
          ...currentData.data,
          members: currentData.data.members.map((m) =>
            isTempMemberId(m.id) ? response.data : m,
          ),
        };
        queryClient.setQueryData<FamilyApiResponse>(familyKeys.family(), {
          ...currentData,
          data: updatedFamily,
        });
        // Write-through to localStorage
        writeFamilyToStorage(updatedFamily);
      }
      callbacks?.onSuccess?.(response);
    },
  });
}

interface UpdateMemberCallbacks {
  onSuccess?: (data: MemberMutationResponse) => void;
  onError?: (error: ApiException) => void;
}

/**
 * Update an existing member.
 */
export function useUpdateMember(callbacks?: UpdateMemberCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateMemberRequest) =>
      familyService.updateMember(id, body),
    // Optimistic update
    onMutate: async (variables) => {
      // Read-only offline: reject before any optimistic cache change.
      assertOnlineForWrite();
      await queryClient.cancelQueries({ queryKey: familyKeys.family() });

      const previousData = queryClient.getQueryData<FamilyApiResponse>(
        familyKeys.family(),
      );

      if (previousData?.data) {
        const optimisticFamily: FamilyData = {
          ...previousData.data,
          members: previousData.data.members.map((m) =>
            m.id === variables.id
              ? {
                  ...m,
                  name: variables.name,
                  color: variables.color,
                  avatarUrl:
                    variables.avatarUrl !== undefined
                      ? (variables.avatarUrl ?? undefined)
                      : m.avatarUrl,
                  email:
                    variables.email !== undefined ? variables.email : m.email,
                }
              : m,
          ),
        };
        queryClient.setQueryData<FamilyApiResponse>(familyKeys.family(), {
          ...previousData,
          data: optimisticFamily,
        });
      }

      return { previousData };
    },
    onError: (error: ApiException, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(familyKeys.family(), context.previousData);
      }
      callbacks?.onError?.(error);
    },
    onSuccess: (response, variables) => {
      // Update the specific member with server response
      const currentData = queryClient.getQueryData<FamilyApiResponse>(
        familyKeys.family(),
      );
      if (currentData?.data) {
        const updatedFamily: FamilyData = {
          ...currentData.data,
          members: currentData.data.members.map((m) =>
            m.id === variables.id ? response.data : m,
          ),
        };
        queryClient.setQueryData<FamilyApiResponse>(familyKeys.family(), {
          ...currentData,
          data: updatedFamily,
        });
        // Write-through to localStorage
        writeFamilyToStorage(updatedFamily);
      }
      callbacks?.onSuccess?.(response);
    },
  });
}

/** Replaces one member in the cached family and in localStorage. */
function patchCachedMember(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  patch: (member: FamilyMember) => FamilyMember,
): void {
  const current = queryClient.getQueryData<FamilyApiResponse>(
    familyKeys.family(),
  );
  if (!current?.data) return;
  const updated: FamilyData = {
    ...current.data,
    members: current.data.members.map((m) => (m.id === id ? patch(m) : m)),
  };
  queryClient.setQueryData<FamilyApiResponse>(familyKeys.family(), {
    ...current,
    data: updated,
  });
  writeFamilyToStorage(updated);
}

/**
 * Makes a member a parent or a kid. Not optimistic: the family password is
 * checked by the server, and a wrong one must not flash the new role.
 */
export function useSetMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & SetMemberRoleRequest) => {
      assertOnlineForWrite();
      return familyService.setMemberRole(id, body);
    },
    onSuccess: (response, variables) => {
      patchCachedMember(queryClient, variables.id, () => response.data);
      // Balances list roles, and a kid's ticks now wait for approval.
      queryClient.invalidateQueries({ queryKey: ["chores"] });
    },
  });
}

/** Sets a parent's own PIN, confirmed with the family password. */
export function useSetMemberPin() {
  const queryClient = useQueryClient();

  return useMutation<void, ApiException, { id: string } & SetMemberPinRequest>({
    mutationFn: ({ id, ...body }) => {
      assertOnlineForWrite();
      return familyService.setMemberPin(id, body);
    },
    onSuccess: (_response, variables) => {
      patchCachedMember(queryClient, variables.id, (member) => ({
        ...member,
        hasPin: true,
      }));
    },
  });
}

interface RemoveMemberCallbacks {
  onSuccess?: () => void;
  onError?: (error: ApiException) => void;
}

/**
 * Remove a member from the family.
 */
export function useRemoveMember(callbacks?: RemoveMemberCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => familyService.removeMember(id),
    // Optimistic delete
    onMutate: async (memberId) => {
      // Read-only offline: reject before any optimistic cache change.
      assertOnlineForWrite();
      await queryClient.cancelQueries({ queryKey: familyKeys.family() });

      const previousData = queryClient.getQueryData<FamilyApiResponse>(
        familyKeys.family(),
      );

      if (previousData?.data) {
        const optimisticFamily: FamilyData = {
          ...previousData.data,
          members: previousData.data.members.filter((m) => m.id !== memberId),
        };
        queryClient.setQueryData<FamilyApiResponse>(familyKeys.family(), {
          ...previousData,
          data: optimisticFamily,
        });
      }

      return { previousData };
    },
    onError: (error: ApiException, _memberId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(familyKeys.family(), context.previousData);
      }
      callbacks?.onError?.(error);
    },
    onSuccess: () => {
      // Get current data and write to localStorage
      const currentData = queryClient.getQueryData<FamilyApiResponse>(
        familyKeys.family(),
      );
      if (currentData?.data) {
        writeFamilyToStorage(currentData.data);
      }
      callbacks?.onSuccess?.();
    },
  });
}

interface DeleteFamilyCallbacks {
  onSuccess?: () => void;
  onError?: (error: ApiException) => void;
}

/**
 * Delete the entire family (reset).
 */
export function useDeleteFamily(callbacks?: DeleteFamilyCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => familyService.deleteFamily(),
    onSuccess: () => {
      // Clear query cache
      queryClient.setQueryData<FamilyApiResponse>(familyKeys.family(), {
        data: null,
      });
      // Clear localStorage
      writeFamilyToStorage(null);
      callbacks?.onSuccess?.();
    },
    onError: (error: ApiException) => {
      callbacks?.onError?.(error);
    },
  });
}
