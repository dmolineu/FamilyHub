/**
 * Sunrise and sunset, good to a few minutes, from the NOAA solar calculator's
 * simplified equations. Used to flip between a daytime and a night-time look.
 *
 * Coordinates come from the family's geocoded weather location when it has
 * one; otherwise {@link approximateCoordinates} guesses a spot from the
 * family's time zone, which is good enough for a look that changes roughly
 * with the light.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface ApproximateCoordinates extends Coordinates {
  /** True when the spot was guessed from a time zone rather than a location. */
  approximate: boolean;
}

export interface SunTimes {
  /** "normal", or the polar cases where the sun never rises or never sets that day. */
  kind: "normal" | "polar-day" | "polar-night";
  sunrise: Date;
  sunset: Date;
}

const ZENITH_DEGREES = 90.833; // official sunrise/sunset: refraction + solar disc
const DEG = Math.PI / 180;
const GUESSED_LATITUDE = 35;
const POLAR_RECHECK_MS = 6 * 60 * 60 * 1000;

interface LocalDate {
  year: number;
  month: number; // 1-12
  day: number;
}

/** The calendar date `at` falls on in `timeZone`. */
function localDate(at: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(at);
  const value = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return { year: value("year"), month: value("month"), day: value("day") };
}

function dayOfYear({ year, month, day }: LocalDate): number {
  const start = Date.UTC(year, 0, 1);
  const date = Date.UTC(year, month - 1, day);
  return Math.round((date - start) / 86_400_000) + 1;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function sunTimes(
  at: Date,
  coordinates: Coordinates,
  timeZone: string,
): SunTimes {
  const date = localDate(at, timeZone);
  const daysInYear = isLeapYear(date.year) ? 366 : 365;
  const midnightUtc = Date.UTC(date.year, date.month - 1, date.day);

  // Fractional year at local noon, in radians.
  const gamma = ((2 * Math.PI) / daysInYear) * (dayOfYear(date) - 1 + 0.5);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const latitude = coordinates.latitude * DEG;
  const cosHourAngle =
    Math.cos(ZENITH_DEGREES * DEG) /
      (Math.cos(latitude) * Math.cos(declination)) -
    Math.tan(latitude) * Math.tan(declination);

  if (cosHourAngle > 1) {
    const noon = new Date(
      midnightUtc + (720 - 4 * coordinates.longitude - eqTime) * 60_000,
    );
    return { kind: "polar-night", sunrise: noon, sunset: noon };
  }
  if (cosHourAngle < -1) {
    return {
      kind: "polar-day",
      sunrise: new Date(midnightUtc - 12 * 3_600_000),
      sunset: new Date(midnightUtc + 36 * 3_600_000),
    };
  }

  const hourAngle = Math.acos(cosHourAngle) / DEG;
  const sunriseMinutes = 720 - 4 * (coordinates.longitude + hourAngle) - eqTime;
  const sunsetMinutes = 720 - 4 * (coordinates.longitude - hourAngle) - eqTime;
  return {
    kind: "normal",
    sunrise: new Date(midnightUtc + sunriseMinutes * 60_000),
    sunset: new Date(midnightUtc + sunsetMinutes * 60_000),
  };
}

export function isDaytime(
  now: Date,
  coordinates: Coordinates,
  timeZone: string,
): boolean {
  const { kind, sunrise, sunset } = sunTimes(now, coordinates, timeZone);
  if (kind === "polar-day") return true;
  if (kind === "polar-night") return false;
  return now >= sunrise && now < sunset;
}

/** When the look next needs re-evaluating: the next sunrise or sunset after `now`. */
export function nextSunBoundary(
  now: Date,
  coordinates: Coordinates,
  timeZone: string,
): Date {
  const today = sunTimes(now, coordinates, timeZone);
  if (today.kind !== "normal") {
    return new Date(now.getTime() + POLAR_RECHECK_MS);
  }
  if (now < today.sunrise) return today.sunrise;
  if (now < today.sunset) return today.sunset;
  const tomorrow = sunTimes(
    new Date(now.getTime() + 24 * 3_600_000),
    coordinates,
    timeZone,
  );
  if (tomorrow.kind !== "normal" || tomorrow.sunrise <= now) {
    return new Date(now.getTime() + POLAR_RECHECK_MS);
  }
  return tomorrow.sunrise;
}

/** The zone's UTC offset at `at`, in minutes; 0 for a zone Intl does not know. */
function utcOffsetMinutes(timeZone: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).formatToParts(at);
    const value = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? "0");
    const asIfUtc = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
    );
    const truncated = Math.floor(at.getTime() / 60_000) * 60_000;
    return Math.round((asIfUtc - truncated) / 60_000);
  } catch {
    return 0;
  }
}

/**
 * A spot on the globe guessed from a time zone: the longitude where that
 * zone's clock matches the sun, at a mid-northern latitude. Within an hour
 * or so of the true sunrise and sunset for most homes.
 */
export function approximateCoordinates(
  timeZone: string,
  at: Date = new Date(),
): ApproximateCoordinates {
  const offsetHours = utcOffsetMinutes(timeZone, at) / 60;
  return {
    latitude: GUESSED_LATITUDE,
    longitude: offsetHours * 15,
    approximate: true,
  };
}
