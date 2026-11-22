import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiException } from "@/api/client";
import { googleCalendarService } from "@/api/services";
import type {
  ApiResponse,
  GoogleCalendarSettings,
  GoogleCalendarSettingsUpdate,
} from "@/lib/types";
import { calendarKeys } from "./use-calendar";

export const googleCalendarKeys = {
  all: ["google-calendar"] as const,
  status: (memberId: string) =>
    [...googleCalendarKeys.all, "status", memberId] as const,
  familyCalendars: () =>
    [...googleCalendarKeys.all, "family-calendars"] as const,
  health: () => [...googleCalendarKeys.all, "health"] as const,
};

// Queries

export function useGoogleConnectionStatus(memberId: string) {
  return useQuery({
    queryKey: googleCalendarKeys.status(memberId),
    queryFn: () => googleCalendarService.getConnectionStatus(memberId),
    enabled: !!memberId,
    staleTime: 30 * 1000,
  });
}

/** Phase 4: every calendar the family's accounts can see, and where new events go. */
export function useGoogleFamilyCalendars(enabled = true) {
  return useQuery({
    queryKey: googleCalendarKeys.familyCalendars(),
    queryFn: () => googleCalendarService.getFamilyCalendars(),
    enabled,
  });
}

/** Phase 4: whether the calendar is up to date and every account can write; checked each minute. */
export function useGoogleHealth() {
  return useQuery({
    queryKey: googleCalendarKeys.health(),
    queryFn: () => googleCalendarService.getHealth(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

// Mutations

interface GoogleMutationCallbacks<T = void> {
  onSuccess?: (data: T) => void;
  onError?: (error: ApiException) => void;
}

/** Phase 4: saves which calendars show, whose lanes they fill and where new events go. */
export function useUpdateGoogleFamilyCalendars(
  callbacks?: GoogleMutationCallbacks<ApiResponse<GoogleCalendarSettings>>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (update: GoogleCalendarSettingsUpdate) =>
      googleCalendarService.updateFamilyCalendars(update),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: googleCalendarKeys.all });
      queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: ApiException) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useSyncGoogleCalendar(callbacks?: GoogleMutationCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      googleCalendarService.syncCalendar(memberId),
    onSuccess: (_data, memberId) => {
      queryClient.invalidateQueries({
        queryKey: googleCalendarKeys.status(memberId),
      });
      queryClient.invalidateQueries({
        queryKey: calendarKeys.events(),
      });
      callbacks?.onSuccess?.();
    },
    onError: (error: ApiException) => {
      callbacks?.onError?.(error);
    },
  });
}

export function useDisconnectGoogle(callbacks?: GoogleMutationCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      googleCalendarService.disconnect(memberId),
    onSuccess: (_data, memberId) => {
      queryClient.invalidateQueries({
        queryKey: googleCalendarKeys.status(memberId),
      });
      queryClient.invalidateQueries({
        queryKey: calendarKeys.events(),
      });
      callbacks?.onSuccess?.();
    },
    onError: (error: ApiException) => {
      callbacks?.onError?.(error);
    },
  });
}
