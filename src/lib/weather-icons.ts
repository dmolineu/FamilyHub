import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  type LucideIcon,
  Moon,
  Sun,
} from "lucide-react";

/** Maps a WMO weather code (as Open-Meteo reports it) to an icon. */
export function weatherIcon(code: number, isDay = true): LucideIcon {
  if (code === 0 || code === 1) return isDay ? Sun : Moon;
  if (code === 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if (code >= 51 && code <= 57) return CloudDrizzle;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return CloudRain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86)
    return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Cloud;
}
