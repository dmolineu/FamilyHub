import { httpClient } from "@/api/client";
import type { WeatherApiResponse } from "@/lib/types";

export const weatherService = {
  /** Resolves to null when the API answers 204 (no location configured). */
  async getWeather(): Promise<WeatherApiResponse | null> {
    // React Query treats undefined data as an error, so a 204 becomes null.
    return (
      (await httpClient.get<WeatherApiResponse | undefined>("/weather")) ?? null
    );
  },
};
