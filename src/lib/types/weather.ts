import type { ApiResponse } from "./api-response";

export interface WeatherCurrent {
  /** Whole degrees Fahrenheit. */
  temperature: number;
  weatherCode: number;
  description: string;
  isDay: boolean;
}

export interface WeatherDay {
  /** Calendar date in the family's timezone, yyyy-MM-dd. */
  date: string;
  weatherCode: number;
  description: string;
  high: number;
  low: number;
  precipitationChance: number | null;
}

export interface WeatherData {
  location: string;
  updatedAt: string;
  current: WeatherCurrent;
  daily: WeatherDay[];
}

/** GET /weather answers 204 (no body) until the family sets a location. */
export type WeatherApiResponse = ApiResponse<WeatherData>;
