import { httpClient } from "@/api/client";
import { fromWire, toWire } from "@/lib/calendar-wire";
import type {
  ApiResponse,
  CalendarEvent,
  CalendarEventResponse,
  CreateEventRequest,
  GetEventsParams,
  UpdateEventRequest,
} from "@/lib/types";

/**
 * The family calendar's API (Phase 4: Google holds the events). Everything in and out
 * goes through `fromWire`/`toWire`, in the family's zone, so the views keep their local
 * day and "9:00 AM" terms. A change passes the event it changes (`existing`), so it keeps
 * what the form does not edit: its other members, a series' excluded dates, its etag.
 * A date of a series is named by its series' id and its `originalStart`.
 */

function mapEventResponse(
  response: ApiResponse<CalendarEventResponse>,
  zone: string,
): ApiResponse<CalendarEvent> {
  return { ...response, data: fromWire(response.data, zone) };
}

function mapEventsResponse(
  response: ApiResponse<CalendarEventResponse[]>,
  zone: string,
): ApiResponse<CalendarEvent[]> {
  return { ...response, data: response.data.map((raw) => fromWire(raw, zone)) };
}

function withEtag(etag?: string | null) {
  return etag ? { params: { etag } } : undefined;
}

export const calendarService = {
  async getEvents(
    params: GetEventsParams,
    zone: string,
  ): Promise<ApiResponse<CalendarEvent[]>> {
    return mapEventsResponse(
      await httpClient.get<ApiResponse<CalendarEventResponse[]>>(
        "/calendar/events",
        {
          params: params as unknown as Record<string, string | undefined>,
        },
      ),
      zone,
    );
  },

  async getEventById(
    id: string,
    zone: string,
  ): Promise<ApiResponse<CalendarEvent>> {
    return mapEventResponse(
      await httpClient.get<ApiResponse<CalendarEventResponse>>(
        `/calendar/events/${id}`,
      ),
      zone,
    );
  },

  async createEvent(
    request: CreateEventRequest,
    zone: string,
  ): Promise<ApiResponse<CalendarEvent>> {
    return mapEventResponse(
      await httpClient.post<ApiResponse<CalendarEventResponse>>(
        "/calendar/events",
        toWire(request, zone),
      ),
      zone,
    );
  },

  async updateEvent(
    id: string,
    request: UpdateEventRequest,
    zone: string,
    existing?: CalendarEvent,
  ): Promise<ApiResponse<CalendarEvent>> {
    return mapEventResponse(
      await httpClient.put<ApiResponse<CalendarEventResponse>>(
        `/calendar/events/${id}`,
        toWire(request, zone, existing),
      ),
      zone,
    );
  },

  async deleteEvent(id: string, etag?: string | null): Promise<void> {
    return httpClient.delete(
      `/calendar/events/${id}`,
      undefined,
      withEtag(etag),
    );
  },

  async updateInstance(
    seriesId: string,
    originalStart: string,
    request: UpdateEventRequest,
    zone: string,
    existing?: CalendarEvent,
  ): Promise<ApiResponse<CalendarEvent>> {
    return mapEventResponse(
      await httpClient.put<ApiResponse<CalendarEventResponse>>(
        `/calendar/events/${seriesId}/instances/${originalStart}`,
        // One date keeps the series' rule; it has none of its own to send.
        { ...toWire(request, zone, existing), recurrence: null },
      ),
      zone,
    );
  },

  async deleteInstance(seriesId: string, originalStart: string): Promise<void> {
    return httpClient.delete(
      `/calendar/events/${seriesId}/instances/${originalStart}`,
    );
  },

  async updateFollowing(
    seriesId: string,
    originalStart: string,
    request: UpdateEventRequest,
    zone: string,
    existing?: CalendarEvent,
  ): Promise<ApiResponse<CalendarEvent>> {
    return mapEventResponse(
      await httpClient.put<ApiResponse<CalendarEventResponse>>(
        `/calendar/events/${seriesId}/instances/${originalStart}/following`,
        toWire(request, zone, existing),
      ),
      zone,
    );
  },

  async deleteFollowing(
    seriesId: string,
    originalStart: string,
  ): Promise<void> {
    return httpClient.delete(
      `/calendar/events/${seriesId}/instances/${originalStart}/following`,
    );
  },
};
