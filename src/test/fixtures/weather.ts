import type { WeatherData } from "@/lib/types";

export const testWeather: WeatherData = {
  location: "San Diego, California",
  updatedAt: "2026-06-21T18:00:00Z",
  current: {
    temperature: 72,
    weatherCode: 2,
    description: "Partly cloudy",
    isDay: true,
  },
  daily: [
    {
      date: "2026-06-21",
      weatherCode: 2,
      description: "Partly cloudy",
      high: 75,
      low: 61,
      precipitationChance: 10,
    },
    {
      date: "2026-06-22",
      weatherCode: 63,
      description: "Rain",
      high: 68,
      low: 58,
      precipitationChance: 80,
    },
    {
      date: "2026-06-23",
      weatherCode: 0,
      description: "Clear sky",
      high: 77,
      low: 60,
      precipitationChance: null,
    },
  ],
};
