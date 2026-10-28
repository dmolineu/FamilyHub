import { useEffect, useState } from "react";

/**
 * The current time, moving on at each minute boundary. A clock on a screen nobody
 * touches must change when the minute does, not up to a minute late, so the next tick
 * is timed to the boundary instead of a fixed interval from mounting. It also catches
 * up as soon as a hidden page (a phone woken from sleep) becomes visible again.
 */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const current = new Date();
      setNow(current);
      const untilNextMinute =
        60_000 - (current.getSeconds() * 1000 + current.getMilliseconds());
      timer = setTimeout(tick, untilNextMinute);
    };
    const schedule = () => {
      clearTimeout(timer);
      tick();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") schedule();
    };

    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return now;
}
