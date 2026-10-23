import { useQuery } from "@tanstack/react-query";
import { weatherService } from "@/api/services/weather.service";

export const weatherKeys = {
  all: ["weather"] as const,
};

const TEN_MINUTES = 10 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * The family's forecast. Refetches on an interval because the wall display never
 * reloads; the server caches upstream calls, so this is cheap.
 */
export function useWeather() {
  return useQuery({
    queryKey: weatherKeys.all,
    queryFn: weatherService.getWeather,
    staleTime: TEN_MINUTES,
    refetchInterval: FIFTEEN_MINUTES,
  });
}
