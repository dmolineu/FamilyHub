import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  useFamilyMembers,
  useGoogleFamilyCalendars,
  useUpdateGoogleFamilyCalendars,
} from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { useBackHandler } from "@/hooks";
import type { GoogleCalendarSetting } from "@/lib/types";

interface GoogleCalendarsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Choice {
  enabled: boolean;
  laneMemberIds: string[];
}

/**
 * The family's Google calendars (Phase 4), chosen once for the whole family: which ones
 * the calendar shows, whose lanes their events go in when an event names no one, and
 * which one new events go on (only one the hub may write to).
 */
export function GoogleCalendarsModal({
  open,
  onOpenChange,
}: GoogleCalendarsModalProps) {
  const { data: response, isLoading } = useGoogleFamilyCalendars(open);
  const update = useUpdateGoogleFamilyCalendars();
  const members = useFamilyMembers();
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const loaded = useRef(false);
  useBackHandler(open, () => onOpenChange(false));

  const calendars: GoogleCalendarSetting[] = response?.data?.calendars ?? [];

  // Take the server's choices once per opening, so edits are not reset by a refetch.
  useEffect(() => {
    if (!response?.data || loaded.current) return;
    loaded.current = true;
    setChoices(
      Object.fromEntries(
        response.data.calendars.map((calendar) => [
          calendar.id,
          { enabled: calendar.enabled, laneMemberIds: calendar.laneMemberIds },
        ]),
      ),
    );
    setDefaultId(response.data.defaultCalendarId);
  }, [response]);

  useEffect(() => {
    if (!open) loaded.current = false;
  }, [open]);

  const choiceOf = (calendar: GoogleCalendarSetting): Choice =>
    choices[calendar.id] ?? {
      enabled: calendar.enabled,
      laneMemberIds: calendar.laneMemberIds,
    };

  const setChoice = (
    calendar: GoogleCalendarSetting,
    change: Partial<Choice>,
  ) =>
    setChoices((previous) => ({
      ...previous,
      [calendar.id]: { ...choiceOf(calendar), ...change },
    }));

  const toggleLane = (calendar: GoogleCalendarSetting, memberId: string) => {
    const lanes = choiceOf(calendar).laneMemberIds;
    setChoice(calendar, {
      laneMemberIds: lanes.includes(memberId)
        ? lanes.filter((id) => id !== memberId)
        : [...lanes, memberId],
    });
  };

  const handleSave = () => {
    update.mutate(
      {
        calendars: calendars.map((calendar) => ({
          id: calendar.id,
          ...choiceOf(calendar),
        })),
        defaultCalendarId: defaultId,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast({
            title: "Calendars updated",
            description: "The family's Google calendars have been saved.",
          });
        },
        onError: (error) => {
          toast({
            title: "Not saved",
            description: error.message,
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Family calendars</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
            {calendars.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No calendars yet. Connect Google on a member's profile first.
              </p>
            )}
            {calendars.map((calendar) => {
              const choice = choiceOf(calendar);
              return (
                <div
                  key={calendar.id}
                  className="rounded-lg border border-border p-3 space-y-2"
                >
                  <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
                    <input
                      type="checkbox"
                      aria-label={`Show ${calendar.summary}`}
                      checked={choice.enabled}
                      onChange={() =>
                        setChoice(calendar, { enabled: !choice.enabled })
                      }
                      className="h-5 w-5 rounded border-border"
                    />
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: calendar.color ?? undefined }}
                      aria-hidden
                    />
                    <span className="text-sm font-medium flex-1">
                      {calendar.summary}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {calendar.writable ? "Can change" : "View only"}
                    </span>
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {members.map((member) => {
                      const on = choice.laneMemberIds.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          aria-label={`${calendar.summary}: ${member.name}`}
                          aria-pressed={on}
                          onClick={() => toggleLane(calendar, member.id)}
                          className={`min-h-[36px] px-3 rounded-full text-xs border ${
                            on
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {member.name}
                        </button>
                      );
                    })}
                  </div>

                  <label className="flex items-center gap-2 text-xs text-muted-foreground min-h-[36px]">
                    <input
                      type="radio"
                      name="default-calendar"
                      aria-label={`New events go on ${calendar.summary}`}
                      checked={defaultId === calendar.id}
                      disabled={!calendar.writable || !choice.enabled}
                      onChange={() => setDefaultId(calendar.id)}
                      className="h-4 w-4"
                    />
                    New events go here
                  </label>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={update.isPending || isLoading}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
