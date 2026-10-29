import { formatDistanceToNow } from "date-fns";
import { CalendarPlus, Image, Mail, Utensils } from "lucide-react";
import { useState } from "react";
import {
  useAddInboxSender,
  useApproveInboxImport,
  useFamilyMembers,
  useInbox,
  useRejectInboxImport,
  useRemoveInboxSender,
  useUndoInboxImport,
} from "@/api";
import { ParentPinPad } from "@/components/chores/parent-pin-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { format12hTo24h, format24hTo12h } from "@/lib/time-utils";
import type {
  FamilyMember,
  InboxImport,
  InboxProposal,
  InboxSender,
} from "@/lib/types";

/** A waiting event as a parent corrects it before it goes on the calendar. */
interface Draft {
  title: string;
  date: string;
  allDay: boolean;
  /** "HH:mm", as a time input holds it. */
  start: string;
  end: string;
  memberId: string;
}

type Action =
  | { kind: "check"; item: InboxImport; draft: Draft }
  | { kind: "approve"; item: InboxImport; draft: Draft }
  | { kind: "reject"; item: InboxImport }
  | { kind: "undo"; item: InboxImport }
  | { kind: "sender"; address: string }
  | { kind: "sender-pin"; address: string }
  | { kind: "remove-sender"; sender: InboxSender };

const RECENT_LIMIT = 10;

function toInputTime(twelveHour: string): string {
  return twelveHour ? format12hTo24h(twelveHour) : "";
}

function draftFor(proposal: InboxProposal, members: FamilyMember[]): Draft {
  const named = proposal.people
    .map((name) =>
      members.find(
        (member) => member.name.toLowerCase() === name.trim().toLowerCase(),
      ),
    )
    .find((member) => member !== undefined);
  return {
    title: proposal.title,
    date: proposal.date ?? "",
    allDay: proposal.allDay,
    start: toInputTime(proposal.startTime),
    end: toInputTime(proposal.endTime),
    memberId: named?.id ?? "",
  };
}

function draftReady(draft: Draft): boolean {
  return (
    draft.title.trim() !== "" &&
    draft.date !== "" &&
    (draft.allDay || draft.start !== "")
  );
}

function when(proposal: InboxProposal | null): string {
  if (!proposal?.date) return "Date unclear";
  if (proposal.allDay) return `${proposal.date}, all day`;
  return proposal.startTime
    ? `${proposal.date}, ${proposal.startTime}${proposal.endTime ? `–${proposal.endTime}` : ""}`
    : `${proposal.date}, time unclear`;
}

function KindIcon({ kind }: { kind: InboxImport["kind"] }) {
  const Icon =
    kind === "EVENT" ? CalendarPlus : kind === "RECIPE" ? Utensils : Image;
  return (
    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
  );
}

/**
 * Settings → Accounts: the family inbox. Where to send photos, flyers and recipes, whether
 * the server is reading it, events waiting for a parent (corrected, then added or
 * turned down), what it added recently (with undo), and who may send. Every decision
 * takes a parent's face and PIN.
 */
export function FamilyInboxSection() {
  const inbox = useInbox();
  const members = useFamilyMembers();
  const approve = useApproveInboxImport();
  const reject = useRejectInboxImport();
  const undo = useUndoInboxImport();
  const addSender = useAddInboxSender();
  const removeSender = useRemoveInboxSender();
  const [action, setAction] = useState<Action | null>(null);
  const data = inbox.data;

  const pending = data?.imports.filter((item) => item.status === "PENDING");
  const recent = data?.imports
    .filter((item) => item.status === "ADDED" || item.status === "UNDONE")
    .slice(0, RECENT_LIMIT);

  const submitApprove = async (
    item: InboxImport,
    draft: Draft,
    approverMemberId: string,
    pin: string,
  ) => {
    await approve.mutateAsync({
      id: item.id,
      request: {
        approverMemberId,
        pin,
        title: draft.title.trim(),
        date: draft.date,
        allDay: draft.allDay,
        ...(draft.allDay
          ? {}
          : {
              startTime: format24hTo12h(draft.start),
              ...(draft.end ? { endTime: format24hTo12h(draft.end) } : {}),
            }),
        ...(draft.memberId ? { memberId: draft.memberId } : {}),
      },
    });
    setAction(null);
  };

  const updateDraft = (changes: Partial<Draft>) => {
    if (action?.kind === "check") {
      setAction({ ...action, draft: { ...action.draft, ...changes } });
    }
  };

  const pinStep = (
    title: string,
    submitLabel: string,
    onSubmit: (approverMemberId: string, pin: string) => Promise<void>,
    back: Action | null,
  ) => (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-sm">{title}</p>
      <ParentPinPad
        prompt="Which parent is this?"
        submitLabel={submitLabel}
        onSubmit={onSubmit}
      />
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 w-full"
        onClick={() => setAction(back)}
      >
        Back
      </Button>
    </div>
  );

  return (
    <section className="space-y-4 pt-4 border-t border-border">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Family inbox
        </h3>
        <p className="text-sm text-muted-foreground">
          Email photos, school flyers, schedules and recipes to the family's own
          address. Dates it is sure of go straight on the calendar and the
          sender is told; anything unclear waits here for a parent.
        </p>
      </div>

      {data && !data.configured && (
        <p className="text-sm text-muted-foreground">
          The inbox is not set up on the server yet.
        </p>
      )}

      {data?.configured && (
        <div className="space-y-1 rounded-lg bg-muted px-3 py-2">
          <p className="flex items-center gap-2 break-all text-sm font-medium text-foreground">
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            {data.address}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.lastReadAt
              ? `Checked ${formatDistanceToNow(new Date(data.lastReadAt), { addSuffix: true })}.`
              : "Not checked yet."}
            {!data.readerAvailable &&
              " Flyers and recipes wait until the server has its reading key; photos still arrive."}
          </p>
        </div>
      )}

      {data?.lastError && (
        <p role="alert" className="text-sm text-destructive">
          {data.lastError}
        </p>
      )}

      {data && (
        <section aria-label="Waiting for a parent" className="space-y-2">
          <h4 className="text-sm font-medium">Waiting for a parent</h4>
          {pending?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing is waiting for a parent.
            </p>
          )}
          <ul className="space-y-2">
            {pending?.map((item) => (
              <li
                key={item.id}
                className="space-y-2 rounded-xl border border-border p-3"
              >
                <div className="flex items-start gap-2">
                  <KindIcon kind={item.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {when(item.proposal)}
                    </p>
                    {item.proposal?.uncertainty && (
                      <p className="text-sm text-muted-foreground">
                        {item.proposal.uncertainty}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      From {item.sender ?? "an email"}
                      {item.subject ? `: ${item.subject}` : ""}
                    </p>
                  </div>
                </div>

                {action?.kind === "check" && action.item.id === item.id && (
                  <div className="space-y-3 rounded-lg bg-muted/50 p-3">
                    <div className="space-y-1">
                      <Label htmlFor={`inbox-title-${item.id}`}>Title</Label>
                      <Input
                        id={`inbox-title-${item.id}`}
                        value={action.draft.title}
                        maxLength={100}
                        onChange={(e) => updateDraft({ title: e.target.value })}
                        className="h-11 bg-input"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`inbox-date-${item.id}`}>Date</Label>
                      <Input
                        id={`inbox-date-${item.id}`}
                        type="date"
                        value={action.draft.date}
                        onChange={(e) => updateDraft({ date: e.target.value })}
                        className="h-11 bg-input"
                      />
                    </div>
                    <div className="flex min-h-11 items-center justify-between gap-3">
                      <Label htmlFor={`inbox-all-day-${item.id}`}>
                        All day
                      </Label>
                      <Switch
                        id={`inbox-all-day-${item.id}`}
                        aria-label="All day"
                        checked={action.draft.allDay}
                        onCheckedChange={(allDay) => updateDraft({ allDay })}
                      />
                    </div>
                    {!action.draft.allDay && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor={`inbox-start-${item.id}`}>
                            Starts
                          </Label>
                          <Input
                            id={`inbox-start-${item.id}`}
                            type="time"
                            value={action.draft.start}
                            onChange={(e) =>
                              updateDraft({ start: e.target.value })
                            }
                            className="h-11 bg-input"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`inbox-end-${item.id}`}>Ends</Label>
                          <Input
                            id={`inbox-end-${item.id}`}
                            type="time"
                            value={action.draft.end}
                            onChange={(e) =>
                              updateDraft({ end: e.target.value })
                            }
                            className="h-11 bg-input"
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label htmlFor={`inbox-member-${item.id}`}>For</Label>
                      <select
                        id={`inbox-member-${item.id}`}
                        value={action.draft.memberId}
                        onChange={(e) =>
                          updateDraft({ memberId: e.target.value })
                        }
                        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-[15px]"
                      >
                        <option value="">Whoever sent it</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11 flex-1"
                        onClick={() => setAction(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="min-h-11 flex-1"
                        disabled={!draftReady(action.draft)}
                        onClick={() =>
                          setAction({
                            kind: "approve",
                            item,
                            draft: action.draft,
                          })
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}

                {action?.kind === "approve" &&
                  action.item.id === item.id &&
                  pinStep(
                    `Add "${action.draft.title.trim()}" to the calendar`,
                    "Add to the calendar",
                    (approverMemberId, pin) =>
                      submitApprove(item, action.draft, approverMemberId, pin),
                    { kind: "check", item, draft: action.draft },
                  )}

                {action?.kind === "reject" &&
                  action.item.id === item.id &&
                  pinStep(
                    `Turn down "${item.title}"`,
                    "Turn it down",
                    async (approverMemberId, pin) => {
                      await reject.mutateAsync({
                        id: item.id,
                        request: { approverMemberId, pin },
                      });
                      setAction(null);
                    },
                    null,
                  )}

                {(!action ||
                  !("item" in action) ||
                  action.item.id !== item.id) && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() =>
                        item.proposal &&
                        setAction({
                          kind: "check",
                          item,
                          draft: draftFor(item.proposal, members),
                        })
                      }
                    >
                      Check and add
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11"
                      onClick={() => setAction({ kind: "reject", item })}
                    >
                      Turn down
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent && recent.length > 0 && (
        <section aria-label="Recently added" className="space-y-2">
          <h4 className="text-sm font-medium">Recently added</h4>
          <ul className="space-y-2">
            {recent.map((item) => (
              <li
                key={item.id}
                className="space-y-2 rounded-xl border border-border p-3"
              >
                <div className="flex items-center gap-2">
                  <KindIcon kind={item.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.status === "UNDONE"
                        ? "Taken off"
                        : `From ${item.sender ?? "an email"}`}
                    </p>
                  </div>
                  {item.status === "ADDED" &&
                    !(
                      action?.kind === "undo" && action.item.id === item.id
                    ) && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11"
                        aria-label={`Undo ${item.title}`}
                        onClick={() => setAction({ kind: "undo", item })}
                      >
                        Undo
                      </Button>
                    )}
                </div>
                {action?.kind === "undo" &&
                  action.item.id === item.id &&
                  pinStep(
                    `Take "${item.title}" off again`,
                    "Take it off",
                    async (approverMemberId, pin) => {
                      await undo.mutateAsync({
                        id: item.id,
                        request: { approverMemberId, pin },
                      });
                      setAction(null);
                    },
                    null,
                  )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && (
        <section aria-label="Who can send" className="space-y-2">
          <h4 className="text-sm font-medium">Who can send</h4>
          <p className="text-xs text-muted-foreground">
            Family members' own email addresses, and any you add here. Mail from
            anyone else is set aside unread.
          </p>
          <ul className="space-y-1">
            {data.memberAddresses.map((address) => (
              <li key={address} className="break-all text-sm">
                {address}
              </li>
            ))}
            {data.extraSenders.map((sender) => (
              <li key={sender.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 break-all text-sm">
                  {sender.address}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  aria-label={`Remove ${sender.address}`}
                  onClick={() => setAction({ kind: "remove-sender", sender })}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>

          {action?.kind === "remove-sender" &&
            pinStep(
              `Stop ${action.sender.address} sending to the inbox`,
              "Remove it",
              async (approverMemberId, pin) => {
                await removeSender.mutateAsync({
                  id: action.sender.id,
                  request: { approverMemberId, pin },
                });
                setAction(null);
              },
              null,
            )}

          {action?.kind === "sender" && (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <Label htmlFor="inbox-sender-address">Email address</Label>
              <Input
                id="inbox-sender-address"
                type="email"
                inputMode="email"
                value={action.address}
                onChange={(e) =>
                  setAction({ kind: "sender", address: e.target.value })
                }
                className="h-11 bg-input"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 flex-1"
                  onClick={() => setAction(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="min-h-11 flex-1"
                  disabled={!action.address.includes("@")}
                  onClick={() =>
                    setAction({ kind: "sender-pin", address: action.address })
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          {action?.kind === "sender-pin" &&
            pinStep(
              `Let ${action.address.trim()} send to the inbox`,
              "Allow this address",
              async (approverMemberId, pin) => {
                await addSender.mutateAsync({
                  approverMemberId,
                  pin,
                  address: action.address,
                });
                setAction(null);
              },
              { kind: "sender", address: action.address },
            )}

          {action?.kind !== "sender" && action?.kind !== "sender-pin" && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setAction({ kind: "sender", address: "" })}
            >
              Allow another address
            </Button>
          )}
        </section>
      )}
    </section>
  );
}
