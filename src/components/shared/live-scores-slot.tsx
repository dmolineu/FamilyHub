import { lazy, Suspense } from "react";
import { useLiveGames } from "@/api";
import { OptionalChunkBoundary } from "./lazy-module";

// The chip and its panel load only once a followed game is on, which keeps the
// popover code out of the entry bundle every device downloads.
const LiveScores = lazy(() =>
  import("./live-scores").then((m) => ({ default: m.LiveScores })),
);

/** Where the header shows live scores; empty (and costs nothing) while no game is on. */
export function LiveScoresSlot() {
  const games = useLiveGames().data;
  if (!games || games.length === 0) return null;
  return (
    <OptionalChunkBoundary>
      <Suspense fallback={null}>
        <LiveScores />
      </Suspense>
    </OptionalChunkBoundary>
  );
}
