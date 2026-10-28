import type { UseQueryOptions } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ApiException } from "@/api/client";
import { FAMILY_DATA_REFRESH_MS } from "@/api/live-refresh";
import { calendarService } from "@/api/services";
import { birthdayEventsInRange } from "@/lib/birthdays";
import { assertOnlineForWrite } from "@/lib/offline/read-only-guard";
import { sportsGameEvents } from "@/lib/sports-events";
import { parseLocalDate } from "@/lib/time-utils";
import type {
  ApiResponse,
  CalendarEvent,
  GetEventsParams,
  UpdateEventRequest,
} from "@/lib/types";
import { useSportsStore } from "@/stores/sports-store";
import { useFamilyData, useFamilyMembers } from "./use-family";
import { useFollowedTeams, useSportsGames } from "./use-sports";

// Query keys factory for type-safe cache management
export const calendarKeys = {
  all: ["calendar"] as const,
  events: () => [...calendarKeys.all, "events"] as const,
  eventList: (params?: GetEventsParams) =>
    [...calendarKeys.events(), params] as const,
  event: (id: string) => [...calendarKeys.events(), id] as const,
};

// Queries

export function useCalendarEvents(
  params: GetEventsParams,
  options?: Omit<
    UseQueryOptions<ApiResponse<CalendarEvent[]>, ApiException>,
    "queryKey" | "queryFn"
  >,
) {
  // Birthdays and followed teams' games are app-side sources: never stored as
  // events, merged into whatever range the views ask for. A device can hide the games.
  const members = useFamilyMembers();
  const timeZone = useFamilyData()?.timezone;
  const { startDate, endDate, memberId } = params;
  const hideSports = useSportsStore((s) => s.hideSports);
  const revealedGameIds = useSportsStore((s) => s.revealedGameIds);
  const games = useSportsGames(startDate, endDate, !hideSports).data;
  const followedTeams = useFollowedTeams().data;
  const select = useCallback(
    (response: ApiResponse<CalendarEvent[]>): ApiResponse<CalendarEvent[]> => {
      const relevant = memberId
        ? members.filter((member) => member.id === memberId)
        : members;
      const birthdays = birthdayEventsInRange(relevant, startDate, endDate);
      const sports =
        hideSports || !games
          ? []
          : sportsGameEvents(
              memberId
                ? games.filter((game) => game.memberIds.includes(memberId))
                : games,
              followedTeams ?? [],
              new Set(revealedGameIds),
              timeZone,
            );
      return birthdays.length === 0 && sports.length === 0
        ? response
        : { ...response, data: [...response.data, ...birthdays, ...sports] };
    },
    [
      members,
      startDate,
      endDate,
      memberId,
      hideSports,
      games,
      followedTeams,
      revealedGameIds,
      timeZone,
    ],
  );
  return useQuery({
    queryKey: calendarKeys.eventList(params),
    queryFn: () => calendarService.getEvents(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: FAMILY_DATA_REFRESH_MS,
    select,
    ...options,
  });
}

export function useCalendarEvent(
  id: string,
  options?: Omit<
    UseQueryOptions<ApiResponse<CalendarEvent>, ApiException>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: calendarKeys.event(id),
    queryFn: () => calendarService.getEventById(id),
    enabled: !!id,
    ...options,
  });
}

// Mutations

interface CreateEventCallbacks {
  onSuccess?: (data: ApiResponse<CalendarEvent>) => void;
  onError?: (error: ApiException) => void;
}

export function useCreateEvent(callbacks?: CreateEventCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: calendarService.createEvent,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
      callbacks?.onSuccess?.(data);
    },
    onError: (error: ApiException) => {
      callbacks?.onError?.(error);
    },
  });
}

interface UpdateEventCallbacks {
  onSuccess?: (data: ApiResponse<CalendarEvent>) => void;
  onError?: (error: ApiException) => void;
}

export function useUpdateEvent(callbacks?: UpdateEventCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateEventRequest) =>
      calendarService.updateEvent(id, body),
    // Optimistic update
    onMutate: async (updatedEvent) => {
      // Read-only offline: reject before any optimistic cache change.
      assertOnlineForWrite();
      await queryClient.cancelQueries({ queryKey: calendarKeys.events() });

      const previousData = queryClient.getQueriesData<
        ApiResponse<CalendarEvent[]>
      >({
        queryKey: calendarKeys.events(),
      });

      queryClient.setQueriesData<ApiResponse<CalendarEvent[]>>(
        { queryKey: calendarKeys.events() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((event) =>
              event.id != null && event.id === updatedEvent.id
                ? {
                    ...event,
                    ...updatedEvent,
                    date: parseLocalDate(updatedEvent.date),
                    endDate: updatedEvent.endDate
                      ? parseLocalDate(updatedEvent.endDate)
                      : undefined,
                    recurrenceRule: updatedEvent.recurrenceRule ?? undefined,
                  }
                : event,
            ),
          };
        },
      );

      return { previousData };
    },
    onError: (error: ApiException, _updatedEvent, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      callbacks?.onError?.(error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
    },
    onSuccess: (data) => {
      callbacks?.onSuccess?.(data);
    },
  });
}

interface DeleteEventCallbacks {
  onSuccess?: () => void;
  onError?: (error: ApiException) => void;
}

export function useDeleteEvent(callbacks?: DeleteEventCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: calendarService.deleteEvent,
    // Optimistic delete
    onMutate: async (eventId) => {
      // Read-only offline: reject before any optimistic cache change.
      assertOnlineForWrite();
      await queryClient.cancelQueries({ queryKey: calendarKeys.events() });

      const previousData = queryClient.getQueriesData<
        ApiResponse<CalendarEvent[]>
      >({
        queryKey: calendarKeys.events(),
      });

      queryClient.setQueriesData<ApiResponse<CalendarEvent[]>>(
        { queryKey: calendarKeys.events() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.filter((event) => event.id !== eventId),
          };
        },
      );

      return { previousData };
    },
    onError: (error: ApiException, _eventId, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      callbacks?.onError?.(error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
    },
    onSuccess: () => {
      callbacks?.onSuccess?.();
    },
  });
}

// Instance mutations (for recurring events — "edit/delete this event")

interface UpdateInstanceCallbacks {
  onSuccess?: (data: ApiResponse<CalendarEvent>) => void;
  onError?: (error: ApiException) => void;
}

export function useUpdateInstance(callbacks?: UpdateInstanceCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      parentId,
      instanceDate,
      ...body
    }: { parentId: string; instanceDate: string } & UpdateEventRequest) =>
      calendarService.updateInstance(parentId, instanceDate, body),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
    },
    onSuccess: (data) => {
      callbacks?.onSuccess?.(data);
    },
    onError: (error: ApiException) => {
      callbacks?.onError?.(error);
    },
  });
}

interface DeleteInstanceCallbacks {
  onSuccess?: () => void;
  onError?: (error: ApiException) => void;
}

export function useDeleteInstance(callbacks?: DeleteInstanceCallbacks) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ parentId, date }: { parentId: string; date: string }) =>
      calendarService.deleteInstance(parentId, date),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: calendarKeys.events() });
    },
    onSuccess: () => {
      callbacks?.onSuccess?.();
    },
    onError: (error: ApiException) => {
      callbacks?.onError?.(error);
    },
  });
}
