import { ArrowLeft, Gift, Lock, Minus, Plus, Settings2 } from "lucide-react";
import { useCallback, useEffect, useReducer, useState } from "react";
import {
  ApiException,
  useArchiveReward,
  useAskForReward,
  useCancelRedemption,
  useChorePoints,
  useCreateReward,
  useFamilyMembers,
  useOpenRewardManagement,
  useRewardShop,
  useUpdateReward,
} from "@/api";
import { MemberAvatar } from "@/components/calendar/components/member-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MobileSheet } from "@/components/ui/mobile-sheet";
import type { Reward } from "@/lib/types";
import { useScreensaverStore } from "@/stores";
import { APPROVALS_AUTO_LOCK_MS } from "./chore-approvals-sheet";
import { ParentPinPad } from "./parent-pin-pad";

interface RewardsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Session {
  approverMemberId: string;
  approverName: string;
  /** Held in this component's memory only, never stored. */
  pin: string;
}

type View =
  | { kind: "who" }
  | { kind: "shop"; memberId: string }
  | { kind: "locked"; notice: string | null }
  | { kind: "manage"; session: Session };

interface Draft {
  id: string | null;
  title: string;
  description: string;
  points: string;
}

const MAX_POINTS = 10_000;

function pointsText(points: number): string {
  return `${points} point${points === 1 ? "" : "s"}`;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "That didn't go through.";
}

/**
 * The rewards shop. Anyone picks who they are and asks for a reward their points
 * cover; the points are held until a parent decides in Approvals. Parents change the
 * rewards after their own PIN, and that lock comes back on closing, after two minutes
 * without a tap, or when the screensaver starts, like the approvals sheet.
 */
export function RewardsSheet({ isOpen, onClose }: RewardsSheetProps) {
  const members = useFamilyMembers();
  const shop = useRewardShop();
  const points = useChorePoints();
  const ask = useAskForReward();
  const cancel = useCancelRedemption();
  const openManagement = useOpenRewardManagement();
  const createReward = useCreateReward();
  const updateReward = useUpdateReward();
  const archiveReward = useArchiveReward();
  const screensaverActive = useScreensaverStore((s) => s.isActive);

  const [view, setView] = useState<View>({ kind: "who" });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [activity, touched] = useReducer((n: number) => n + 1, 0);

  const rewards = shop.data?.rewards ?? [];
  const waiting = shop.data?.waiting ?? [];

  const reset = useCallback((next: View) => {
    setView(next);
    setStatus(null);
    setError(null);
    setDraft(null);
    setRemovingId(null);
  }, []);

  const lock = useCallback(
    (notice: string | null) => reset({ kind: "locked", notice }),
    [reset],
  );

  useEffect(() => {
    if (!isOpen) reset({ kind: "who" });
  }, [isOpen, reset]);

  const managing = view.kind === "manage";
  useEffect(() => {
    if (screensaverActive && managing) {
      lock("Locked when the screensaver started.");
    }
  }, [screensaverActive, managing, lock]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: activity restarts the countdown on every tap or key.
  useEffect(() => {
    if (!managing) return;
    const timer = window.setTimeout(
      () =>
        lock("Locked after 2 minutes without a tap. Enter a PIN to carry on."),
      APPROVALS_AUTO_LOCK_MS,
    );
    return () => window.clearTimeout(timer);
  }, [managing, activity, lock]);

  // Kids first: the shop is mostly for them.
  const shoppers = [
    ...members.filter((m) => m.role === "KID"),
    ...members.filter((m) => m.role !== "KID"),
  ];

  const balanceOf = (memberId: string) =>
    points.data?.find((p) => p.memberId === memberId)?.points ?? 0;
  const heldBy = (memberId: string) =>
    waiting
      .filter((r) => r.memberId === memberId)
      .reduce((sum, r) => sum + r.points, 0);

  const renderWho = () => (
    <div className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="mb-3 text-base font-semibold text-foreground">
          Who is choosing?
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shoppers.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => reset({ kind: "shop", memberId: member.id })}
              className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-3 font-medium hover:bg-muted active:scale-[0.97]"
            >
              <MemberAvatar
                name={member.name}
                color={member.color}
                avatarUrl={member.avatarUrl}
                className="h-12 w-12 text-lg"
              />
              {member.name}
            </button>
          ))}
        </div>
      </fieldset>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full gap-2"
        onClick={() => lock(null)}
      >
        <Settings2 className="h-4 w-4" aria-hidden="true" />
        Manage rewards
      </Button>
    </div>
  );

  const renderShop = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    const name = member?.name ?? "Someone";
    const held = heldBy(memberId);
    const available = Math.max(0, balanceOf(memberId) - held);
    const mine = waiting.filter((r) => r.memberId === memberId);

    const askFor = async (reward: Reward) => {
      setStatus(null);
      setError(null);
      try {
        await ask.mutateAsync({ rewardId: reward.id, memberId });
        setStatus(`Asked for ${reward.title}. A parent will decide.`);
      } catch (e) {
        setError(messageOf(e));
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-11 gap-1 px-3"
            onClick={() => reset({ kind: "who" })}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Someone else
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {member && (
            <MemberAvatar
              name={member.name}
              color={member.color}
              avatarUrl={member.avatarUrl}
              className="h-12 w-12 text-lg"
            />
          )}
          <p className="text-lg font-semibold text-foreground">
            {name} has {pointsText(available)} to spend
            {held > 0 && ` (${held} waiting)`}
          </p>
        </div>

        {status && (
          <p
            role="status"
            className="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground"
          >
            {status}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {rewards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rewards yet. A parent can add some with Manage rewards.
          </p>
        ) : (
          <ul aria-label="Rewards" className="space-y-2">
            {rewards.map((reward) => {
              const short = reward.points - available;
              return (
                <li
                  key={reward.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <Gift
                    className="h-6 w-6 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      {reward.title}
                    </p>
                    {reward.description && (
                      <p className="text-sm text-muted-foreground">
                        {reward.description}
                      </p>
                    )}
                    <p className="text-sm font-medium text-muted-foreground">
                      {pointsText(reward.points)}
                      {short > 0 && (
                        <span className="block text-xs">
                          Needs {short} more point{short === 1 ? "" : "s"}
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="min-h-11 shrink-0"
                    aria-label={`Ask for ${reward.title}`}
                    disabled={short > 0 || ask.isPending}
                    onClick={() => askFor(reward)}
                  >
                    Ask for it
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {mine.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Waiting for a parent
            </h3>
            <ul aria-label="Waiting for a parent" className="space-y-2">
              {mine.map((redemption) => (
                <li
                  key={redemption.id}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {redemption.rewardTitle}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {pointsText(redemption.points)} held
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 shrink-0"
                    aria-label={`Take back ${redemption.rewardTitle}`}
                    disabled={cancel.isPending}
                    onClick={async () => {
                      setStatus(null);
                      setError(null);
                      try {
                        await cancel.mutateAsync({
                          redemptionId: redemption.id,
                          memberId,
                        });
                      } catch (e) {
                        setError(messageOf(e));
                      }
                    }}
                  >
                    Take back
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  };

  const unlock = async (approverMemberId: string, pin: string) => {
    await openManagement.mutateAsync({ approverMemberId, pin });
    reset({
      kind: "manage",
      session: {
        approverMemberId,
        approverName:
          members.find((m) => m.id === approverMemberId)?.name ?? "a parent",
        pin,
      },
    });
  };

  const renderLocked = (notice: string | null) => (
    <div className="space-y-4">
      <Button
        type="button"
        variant="ghost"
        className="h-11 gap-1 px-3"
        onClick={() => reset({ kind: "who" })}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to the shop
      </Button>
      {notice && (
        <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}
      <ParentPinPad
        prompt="Who is changing the rewards?"
        submitLabel="Open"
        onSubmit={unlock}
      />
    </div>
  );

  const renderManage = (session: Session) => {
    // A refused PIN (say it was locked from another screen) ends the session.
    const failed = (e: unknown) => {
      if (e instanceof ApiException && e.status === 403) lock(e.message);
      else setError(messageOf(e));
    };

    const save = async () => {
      if (!draft) return;
      setError(null);
      const title = draft.title.trim();
      const value = Number(draft.points);
      if (!title) {
        setError("Give the reward a name.");
        return;
      }
      if (!Number.isInteger(value) || value < 1 || value > MAX_POINTS) {
        setError("A reward costs 1 to 10,000 points.");
        return;
      }
      const body = {
        approverMemberId: session.approverMemberId,
        pin: session.pin,
        title,
        description: draft.description.trim() || null,
        points: value,
      };
      try {
        if (draft.id) await updateReward.mutateAsync({ id: draft.id, ...body });
        else await createReward.mutateAsync(body);
        setStatus(`Saved ${title}.`);
        setDraft(null);
      } catch (e) {
        failed(e);
      }
    };

    const step = (delta: number) =>
      setDraft((current) =>
        current
          ? {
              ...current,
              points: String(
                Math.min(
                  MAX_POINTS,
                  Math.max(1, (Number(current.points) || 0) + delta),
                ),
              ),
            }
          : current,
      );

    const form = draft && (
      <div className="space-y-3 rounded-xl border border-primary/40 bg-card p-3">
        <div className="space-y-1">
          <Label htmlFor="reward-title">Reward</Label>
          <Input
            id="reward-title"
            value={draft.title}
            maxLength={60}
            placeholder="30 minutes of screen time"
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="bg-input"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reward-description">Description (optional)</Label>
          <Input
            id="reward-description"
            value={draft.description}
            maxLength={200}
            placeholder="Any day after homework"
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            className="bg-input"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reward-points">Points</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="5 fewer points"
              onClick={() => step(-5)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              id="reward-points"
              inputMode="numeric"
              value={draft.points}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  points: e.target.value.replace(/\D/g, ""),
                })
              }
              className="h-11 w-24 bg-input text-center"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="5 more points"
              onClick={() => step(5)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 flex-1"
            onClick={() => setDraft(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-11 flex-1"
            disabled={createReward.isPending || updateReward.isPending}
            onClick={save}
          >
            Save reward
          </Button>
        </div>
      </div>
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            Changing rewards as {session.approverName}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            onClick={() => lock(null)}
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            Lock
          </Button>
        </div>

        {status && (
          <p
            role="status"
            className="rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground"
          >
            {status}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {draft && !draft.id && form}
        {!draft && (
          <Button
            type="button"
            className="h-11 w-full gap-2"
            onClick={() =>
              setDraft({ id: null, title: "", description: "", points: "10" })
            }
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add a reward
          </Button>
        )}

        <ul aria-label="Rewards on offer" className="space-y-2">
          {rewards.map((reward) =>
            draft?.id === reward.id ? (
              <li key={reward.id}>{form}</li>
            ) : (
              <li
                key={reward.id}
                className="space-y-2 rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">
                      {reward.title}
                    </p>
                    {reward.description && (
                      <p className="text-sm text-muted-foreground">
                        {reward.description}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {pointsText(reward.points)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    aria-label={`Edit ${reward.title}`}
                    onClick={() =>
                      setDraft({
                        id: reward.id,
                        title: reward.title,
                        description: reward.description ?? "",
                        points: String(reward.points),
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11"
                    aria-label={`Remove ${reward.title}`}
                    onClick={() => setRemovingId(reward.id)}
                  >
                    Remove
                  </Button>
                </div>
                {removingId === reward.id && (
                  <div className="space-y-2 rounded-md bg-muted p-3">
                    <p className="text-sm">
                      Remove {reward.title} from the shop? Asks already waiting
                      can still be decided.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 flex-1"
                        onClick={() => setRemovingId(null)}
                      >
                        Keep it
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="min-h-11 flex-1"
                        disabled={archiveReward.isPending}
                        onClick={async () => {
                          try {
                            await archiveReward.mutateAsync({
                              id: reward.id,
                              approverMemberId: session.approverMemberId,
                              pin: session.pin,
                            });
                            setRemovingId(null);
                          } catch (e) {
                            failed(e);
                          }
                        }}
                      >
                        Remove reward
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      </div>
    );
  };

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Rewards"
      initialHeight="full"
    >
      <div
        className="space-y-4 py-2"
        onPointerDown={touched}
        onKeyDown={touched}
      >
        {view.kind === "who" && renderWho()}
        {view.kind === "shop" && renderShop(view.memberId)}
        {view.kind === "locked" && renderLocked(view.notice)}
        {view.kind === "manage" && renderManage(view.session)}
      </div>
    </MobileSheet>
  );
}
