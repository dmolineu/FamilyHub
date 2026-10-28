import { Eye } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";
import { useFamilyData, useGameSummary, useLiveGames } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { gameStartTime } from "@/lib/sports-events";
import type { GameSideInfo, SportsGame } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSportsStore } from "@/stores/sports-store";

/** An open panel closes itself after this long untouched, so the wall stays tidy. */
export const LIVE_PANEL_AUTO_CLOSE_MS = 20 * 1000;
const SHOWN_CHIPS = 2;
/** A click this soon after a mouse hover opened the panel keeps it open. */
const HOVER_CLICK_GRACE_MS = 600;

function label(side: GameSideInfo): string {
  return side.abbreviation ?? side.name;
}

function Logo({ side }: { side: GameSideInfo }) {
  if (!side.logoUrl) return null;
  return (
    <img
      src={side.logoUrl}
      alt=""
      draggable={false}
      className="h-5 w-5 shrink-0 object-contain"
    />
  );
}

/** The details panel: the line, the situation, the leaders and where to watch. */
function LiveGamePanel({
  game,
  visible,
  onReveal,
}: {
  game: SportsGame;
  visible: boolean;
  onReveal: () => void;
}) {
  // Read only while the panel is open and the score may be shown.
  const summary = useGameSummary(visible ? game.id : null).data;
  return (
    <div className="space-y-3">
      <p className="font-semibold leading-tight">
        {game.away.name} at {game.home.name}
      </p>
      {visible ? (
        <>
          <div className="flex items-center gap-3 text-lg font-semibold">
            <Logo side={game.away} />
            {label(game.away)} {game.away.score ?? 0}
            <span className="text-muted-foreground">–</span>
            {game.home.score ?? 0} {label(game.home)}
            <Logo side={game.home} />
          </div>
          {game.detail && (
            <p className="text-sm text-muted-foreground">{game.detail}</p>
          )}
          {summary && summary.lines.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left font-medium" />
                  {summary.lines[0].stats.map((stat) => (
                    <th
                      key={stat.label}
                      className="w-10 text-right font-medium"
                    >
                      {stat.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.lines.map((line) => (
                  <tr key={line.abbreviation}>
                    <td className="font-medium">{line.abbreviation}</td>
                    {line.stats.map((stat) => (
                      <td key={stat.label} className="text-right tabular-nums">
                        {stat.value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {summary && summary.situation.length > 0 && (
            <ul className="space-y-0.5 text-sm">
              {summary.situation.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {summary && summary.leaders.length > 0 && (
            <ul className="space-y-1 text-sm">
              {summary.leaders.map((leader) => (
                <li key={`${leader.label}-${leader.name}`}>
                  <span className="text-muted-foreground">
                    {leader.label}:{" "}
                  </span>
                  <span className="font-medium">{leader.name}</span>{" "}
                  {leader.line}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Score hidden</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-2"
            onClick={onReveal}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Reveal score
          </Button>
        </div>
      )}
      {game.broadcasts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          On {game.broadcasts.join(", ")}
        </p>
      )}
    </div>
  );
}

/** One live game: tap (or hover with a mouse) for the panel. */
function LiveGameChip({ game }: { game: SportsGame }) {
  const timeZone = useFamilyData()?.timezone;
  const revealed = useSportsStore((s) => s.revealedGameIds.includes(game.id));
  const reveal = useSportsStore((s) => s.reveal);
  const [open, setOpen] = useState(false);
  const [activity, touched] = useReducer((n: number) => n + 1, 0);
  const hoverOpenedAt = useRef(0);
  const visible = !game.hideScores || revealed;
  const live = game.state === "LIVE";

  // biome-ignore lint/correctness/useExhaustiveDependencies: activity restarts the countdown on every touch.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(
      () => setOpen(false),
      LIVE_PANEL_AUTO_CLOSE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open, activity]);

  const matchup = `${game.away.name} at ${game.home.name}`;
  const name = !live
    ? `Starting soon: ${matchup}, ${gameStartTime(game, timeZone)}`
    : visible
      ? `Live: ${game.away.name} ${game.away.score ?? 0}, ${game.home.name} ${game.home.score ?? 0}${game.detail ? `, ${game.detail}` : ""}`
      : `Live: ${matchup}, score hidden`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        // A mouse click lands right after the hover that opened the panel; without
        // this the click would toggle it straight shut again.
        if (
          !next &&
          Date.now() - hoverOpenedAt.current < HOVER_CLICK_GRACE_MS
        ) {
          return;
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={name}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse" && !open) {
              hoverOpenedAt.current = Date.now();
              setOpen(true);
            }
          }}
          className={cn(
            "-my-1 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold tabular-nums transition-colors",
            live
              ? "border-red-500/40 bg-red-500/10 text-foreground"
              : "border-border bg-muted text-muted-foreground",
          )}
        >
          {live && (
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-red-500 motion-safe:animate-pulse"
            />
          )}
          <span aria-hidden="true">
            {live && visible
              ? `${label(game.away)} ${game.away.score ?? 0} – ${label(game.home)} ${game.home.score ?? 0}`
              : `${label(game.away)} @ ${label(game.home)}`}
          </span>
          <span
            aria-hidden="true"
            className="font-normal text-muted-foreground"
          >
            {live
              ? visible
                ? (game.detail ?? "Live")
                : "Live"
              : gameStartTime(game, timeZone)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label={matchup}
        className="w-80"
        onPointerDown={touched}
        onKeyDown={touched}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setOpen(false);
        }}
      >
        <LiveGamePanel
          game={game}
          visible={visible}
          onReveal={() => {
            reveal(game.id);
            touched();
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Followed teams' games that are on now or about to start, for the header on every
 * screen. Nothing at all while no game is on.
 */
export function LiveScores() {
  const games = useLiveGames().data ?? [];
  if (games.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {games.slice(0, SHOWN_CHIPS).map((game) => (
        <LiveGameChip key={game.id} game={game} />
      ))}
      {games.length > SHOWN_CHIPS && (
        <span className="text-xs text-muted-foreground">
          +{games.length - SHOWN_CHIPS}
        </span>
      )}
    </div>
  );
}
