import { Cake } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useFamilyData,
  useFamilyMembers,
  useFolderPhotoSample,
  usePhotos,
  usePhotoUrl,
  useWeather,
} from "@/api";
import {
  countdownLabel,
  todayInZone,
  upcomingBirthdays,
} from "@/lib/birthdays";
import { formatDayInZone, formatTimeInZone } from "@/lib/chore-times";
import { isNightTime } from "@/lib/night";
import { weatherIcon } from "@/lib/weather-icons";
import { useScreensaverStore } from "@/stores";

interface ScreensaverProps {
  onDismiss: () => void;
  /** Shuffle the photos (the default); tests turn it off for a fixed order. */
  shuffle?: boolean;
}

/** Auto-advance interval (user request: every 10 seconds). */
export const SCREENSAVER_ADVANCE_MS = 10_000;
/** Horizontal travel that counts as a swipe rather than a tap. */
const SWIPE_PX = 50;
/** Any more movement than this is not a tap either (e.g. a vertical drag). */
const TAP_SLOP_PX = 12;
const CLOCK_TICK_MS = 15_000;

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * The photo frame: the family's photos every 10 seconds, with the time, the day
 * and date, the weather and everyone's birthday countdown. Swipe left or right
 * (or use the arrow keys) to move between photos; a tap or any other key closes
 * it. It covers the screen without closing anything beneath, and it swallows
 * its own taps and keys so a dialog underneath never sees them.
 */
export function Screensaver({ onDismiss, shuffle = true }: ScreensaverProps) {
  const photos = usePhotos();
  const family = useFamilyData();
  const members = useFamilyMembers();
  const weather = useWeather();
  const timeZone =
    family?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  // Pictures from the family's own photo folder join the uploads.
  const folderPhotos = useFolderPhotoSample();

  // One order per showing; reshuffled only when photos are added or removed.
  const idsKey = [
    ...(photos.data ?? []).map((photo) => photo.id),
    ...(folderPhotos.data ?? []),
  ].join("|");
  const order = useMemo(() => {
    const ids = idsKey ? idsKey.split("|") : [];
    return shuffle ? shuffled(ids) : ids;
  }, [idsKey, shuffle]);
  const count = order.length;
  const [index, setIndex] = useState(0);
  const currentId = count > 0 ? order[index % count] : null;
  const nextId = count > 1 ? order[(index + 1) % count] : null;
  const currentUrl = usePhotoUrl(currentId, "content");
  // Fetch the next photo ahead of time so the change is instant.
  usePhotoUrl(nextId, "content");

  // Keep showing the previous photo until the next one has loaded.
  const [shown, setShown] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!currentId) setShown(null);
    else if (currentUrl) setShown({ id: currentId, url: currentUrl });
  }, [currentId, currentUrl]);

  const step = useCallback(
    (by: 1 | -1) => {
      if (count === 0) return;
      setIndex((i) => (i + by + count) % count);
    },
    [count],
  );

  // Re-armed on every change, so a swipe restarts the 10 seconds.
  // biome-ignore lint/correctness/useExhaustiveDependencies: index is the re-arm trigger; dropping it would let a swipe land 1 second before the next auto-advance.
  useEffect(() => {
    if (count < 2) return;
    const timer = window.setTimeout(() => step(1), SCREENSAVER_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [index, count, step]);

  // Capture phase on window, ahead of any dialog's own Escape handling.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
      else onDismiss();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onDismiss, step]);

  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const ignoreClick = useRef(false);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Keep the press from reaching a dialog's "tap outside to close".
    event.stopPropagation();
    pressStart.current = { x: event.clientX, y: event.clientY };
    ignoreClick.current = false;
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const start = pressStart.current;
    pressStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      ignoreClick.current = true;
      // Swipe left (finger moves left) for the next photo, like a phone gallery.
      step(dx < 0 ? 1 : -1);
    } else if (Math.abs(dx) > TAP_SLOP_PX || Math.abs(dy) > TAP_SLOP_PX) {
      ignoreClick.current = true;
    }
  };

  // Close on click, not pointer up: the click is then spent on this layer and
  // cannot fall through to whatever is under the finger once it disappears.
  const onClick = () => {
    if (ignoreClick.current) {
      ignoreClick.current = false;
      return;
    }
    onDismiss();
  };

  const night = useScreensaverStore((s) => s.night);
  // During this device's night hours the wall shows nothing at all; a tap still wakes it.
  const dark =
    night.enabled && isNightTime(now, timeZone, night.from, night.to);

  const nowIso = now.toISOString();
  const birthdays = upcomingBirthdays(members, todayInZone(now, timeZone), 366);
  const current = weather.data?.data?.current;
  const WeatherIcon = current
    ? weatherIcon(current.weatherCode, current.isDay)
    : null;

  return (
    <div
      data-testid="screensaver"
      data-night={dark ? "true" : "false"}
      role="dialog"
      aria-modal="true"
      aria-label="Screensaver. Tap to close, swipe to change photo."
      className="fixed inset-0 z-[200] cursor-none touch-none select-none overflow-hidden bg-black text-white"
      // A modal dialog underneath sets pointer-events: none on the body.
      style={{ pointerEvents: "auto" }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      // A cancelled press (the browser took over the gesture) is neither a
      // swipe nor a tap.
      onPointerCancel={() => {
        pressStart.current = null;
        ignoreClick.current = true;
      }}
      // Dragging across a photo would otherwise start the browser's own image
      // drag, which swallows the swipe.
      onDragStart={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {dark ? null : shown ? (
        <>
          {/* The same photo, blurred, fills the edges around portrait shots. */}
          <img
            src={shown.url}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-2xl"
          />
          <img
            key={shown.id}
            data-testid="screensaver-photo"
            data-photo-id={shown.id}
            src={shown.url}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain animate-in fade-in duration-1000 motion-reduce:animate-none"
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-black" />
      )}

      {!dark && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-[5vmin] pt-[14vmin] pb-[5vmin]">
          <div className="flex flex-wrap items-end justify-between gap-[4vmin]">
            <div className="drop-shadow-lg">
              <p
                data-testid="screensaver-time"
                className="text-[13vmin] leading-none font-semibold tabular-nums"
              >
                {formatTimeInZone(nowIso, timeZone)}
              </p>
              <p className="mt-[1.5vmin] text-[5vmin] leading-tight font-medium">
                {formatDayInZone(nowIso, timeZone)}
              </p>
              {current && WeatherIcon && (
                <div className="mt-[2vmin] flex items-center gap-[1.5vmin] text-[4.2vmin] leading-none">
                  <WeatherIcon
                    className="h-[5.5vmin] w-[5.5vmin]"
                    aria-hidden="true"
                  />
                  <span className="font-semibold">{current.temperature}°</span>
                  <span className="text-white/85">{current.description}</span>
                </div>
              )}
            </div>

            {birthdays.length > 0 && (
              <section
                aria-label="Birthdays"
                className="min-w-[30vmin] rounded-[2vmin] bg-black/35 px-[3vmin] py-[2vmin] backdrop-blur-sm"
              >
                <h2 className="mb-[1vmin] flex items-center gap-[1vmin] text-[3vmin] font-semibold tracking-wide text-white/80 uppercase">
                  <Cake
                    className="h-[3.2vmin] w-[3.2vmin]"
                    aria-hidden="true"
                  />
                  Birthdays
                </h2>
                <ul className="space-y-[0.8vmin]">
                  {birthdays.map((b) => (
                    <li
                      key={b.member.id}
                      className="flex items-baseline justify-between gap-[3vmin] text-[3.4vmin] leading-tight"
                    >
                      <span className="font-semibold">{b.member.name}</span>
                      <span className="text-white/85">
                        {countdownLabel(b.daysUntil)}
                        {b.turning ? ` · turns ${b.turning}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
