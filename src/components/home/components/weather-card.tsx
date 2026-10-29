import { format } from "date-fns";
import { parseLocalDate } from "@/lib/time-utils";
import type { WeatherData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { weatherIcon } from "@/lib/weather-icons";

interface WeatherCardProps {
  /** "large" is the wall/desktop strip; "compact" is the one-line mobile form. */
  variant: "large" | "compact";
  /** Undefined or null means no location is configured yet. */
  weather: WeatherData | null | undefined;
  isLoading?: boolean;
  className?: string;
}

function dayLabel(date: string, index: number): string {
  return index === 0 ? "Today" : format(parseLocalDate(date), "EEE");
}

/**
 * Today's conditions and the next few days, from the family's configured location.
 * The large variant is a landmark region so the wall's screen reader users and the
 * tests can find it by name; the compact one stays a single line under the header.
 */
export function WeatherCard({
  variant,
  weather,
  isLoading = false,
  className,
}: WeatherCardProps) {
  if (variant === "compact") {
    if (!weather) return null;
    const Icon = weatherIcon(
      weather.current.weatherCode,
      weather.current.isDay,
    );
    const today = weather.daily[0];
    return (
      <section
        aria-label="Weather"
        className={cn(
          "flex items-center gap-2 px-4 pt-2 text-sm text-muted-foreground",
          className,
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold text-foreground">
            {weather.current.temperature}°
          </span>{" "}
          {weather.current.description}
          {today && (
            <>
              {" · "}H {today.high}° L {today.low}°
            </>
          )}
        </span>
      </section>
    );
  }

  const shell =
    "rounded-lg border border-border/70 bg-card px-4 py-4 shadow-sm";

  if (isLoading && !weather) {
    return (
      <section aria-label="Weather" className={cn(shell, className)}>
        <p className="text-sm text-muted-foreground">Loading weather…</p>
      </section>
    );
  }

  if (!weather) {
    return (
      <section aria-label="Weather" className={cn(shell, className)}>
        <p className="text-sm text-muted-foreground">
          Add a location in Settings → Weather & Sports to see the weather here.
        </p>
      </section>
    );
  }

  const CurrentIcon = weatherIcon(
    weather.current.weatherCode,
    weather.current.isDay,
  );

  return (
    <section
      aria-label="Weather"
      className={cn(
        shell,
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-4",
        className,
      )}
    >
      <div className="flex items-center gap-4">
        <CurrentIcon
          className="h-12 w-12 shrink-0 text-foreground"
          aria-hidden="true"
        />
        <div>
          <p className="text-4xl font-semibold leading-none text-foreground">
            {weather.current.temperature}°
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {weather.current.description}
          </p>
          <p className="text-xs text-muted-foreground">{weather.location}</p>
        </div>
      </div>

      <ul className="flex gap-4">
        {weather.daily.map((day, index) => {
          const Icon = weatherIcon(day.weatherCode, true);
          return (
            <li
              key={day.date}
              className="flex min-w-14 flex-col items-center gap-1 text-center"
            >
              <span className="text-xs font-semibold text-muted-foreground">
                {dayLabel(day.date, index)}
              </span>
              <Icon className="h-6 w-6 text-foreground" aria-hidden="true" />
              <span className="text-sm text-foreground">
                {day.high}°
                <span className="text-muted-foreground"> / {day.low}°</span>
              </span>
              {day.precipitationChance !== null && (
                <span className="text-xs text-muted-foreground">
                  {day.precipitationChance}%
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
