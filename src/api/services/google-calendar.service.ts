import { httpClient } from "@/api/client";
import type {
  ApiResponse,
  GoogleAuthUrl,
  GoogleCalendarSettings,
  GoogleCalendarSettingsUpdate,
  GoogleConnectionStatus,
  GoogleHealth,
} from "@/lib/types";

export const googleCalendarService = {
  async getAuthUrl(memberId: string): Promise<ApiResponse<GoogleAuthUrl>> {
    return httpClient.get<ApiResponse<GoogleAuthUrl>>("/google/auth", {
      params: { memberId },
    });
  },

  async getConnectionStatus(
    memberId: string,
  ): Promise<ApiResponse<GoogleConnectionStatus>> {
    return httpClient.get<ApiResponse<GoogleConnectionStatus>>(
      `/google/status/${memberId}`,
    );
  },

  /** Phase 4: every calendar the family's accounts can see, and the default. */
  async getFamilyCalendars(): Promise<ApiResponse<GoogleCalendarSettings>> {
    return httpClient.get<ApiResponse<GoogleCalendarSettings>>(
      "/google/calendars",
    );
  },

  /** Phase 4: which calendars show, whose lanes they fill, where new events go. */
  async updateFamilyCalendars(
    update: GoogleCalendarSettingsUpdate,
  ): Promise<ApiResponse<GoogleCalendarSettings>> {
    return httpClient.put<ApiResponse<GoogleCalendarSettings>>(
      "/google/calendars",
      update,
    );
  },

  /** Phase 4: whether the calendar is up to date and every account can write. */
  async getHealth(): Promise<ApiResponse<GoogleHealth>> {
    return httpClient.get<ApiResponse<GoogleHealth>>("/google/health");
  },

  async syncCalendar(memberId: string): Promise<void> {
    return httpClient.post(`/google/sync/${memberId}`);
  },

  async disconnect(memberId: string): Promise<void> {
    return httpClient.delete(`/google/disconnect/${memberId}`);
  },
};
