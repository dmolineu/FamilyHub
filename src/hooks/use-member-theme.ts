import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useFamilyData, useFamilyMembers, useThemePacks } from "@/api";
import { themePackKeys } from "@/api/hooks/use-theme-packs";
import { themePackService } from "@/api/services/theme-pack.service";
import { memberThemeSelection, sameSelection } from "@/lib/member-theme";
import type { FamilyMember } from "@/lib/types";
import { useThemeStore } from "@/stores/theme-store";

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "touchstart",
  "wheel",
] as const;

/** Touches are written to the store (and so to localStorage) at most this often. */
const ACTIVITY_WRITE_MS = 15_000;

/**
 * Shows a member's own look on this screen: their built-in look, or their
 * pack (fetched and cached the first time, so it also paints offline and
 * before load). Someone without a look of their own brings back the screen's
 * own look. Only this screen changes. If the pack cannot be fetched (offline),
 * the screen keeps the look it has.
 */
export function useShowMemberTheme() {
  const queryClient = useQueryClient();

  return useCallback(
    async (member: FamilyMember, options?: { keepActivity?: boolean }) => {
      try {
        const packs = member.theme?.startsWith("pack:")
          ? await queryClient.ensureQueryData({
              queryKey: themePackKeys.list(),
              queryFn: themePackService.list,
            })
          : [];
        const selection = memberThemeSelection(member.theme, packs);
        if (!selection) {
          useThemeStore.getState().showPerson(null);
          return;
        }
        if (
          selection.kind === "pack" &&
          !useThemeStore.getState().appliedPacks[selection.id]
        ) {
          const document = await themePackService.getDocument(selection.id);
          useThemeStore.getState().cachePack({
            id: selection.id,
            name: document.name,
            dark: document.dark,
            tokens: document.tokens,
            images: document.images ?? {},
            slots: document.slots,
          });
        }
        const current = useThemeStore.getState().person;
        useThemeStore.getState().showPerson({
          memberId: member.id,
          selection,
          // Following a changed look is not a touch: the countdown carries on.
          lastActiveAt:
            options?.keepActivity && current
              ? current.lastActiveAt
              : Date.now(),
        });
      } catch (error) {
        console.warn(`Could not show ${member.name}'s theme`, error);
      }
    },
    [queryClient],
  );
}

/**
 * Looks after a person's look on this screen, once, for the whole app:
 * - goes back to the screen's own look after the family's revert time with
 *   nobody touching the screen (never, when the family chose Never), counting
 *   across reloads, so the wall's self-updates do not reset it;
 * - follows that person when they change their look, and goes back to the
 *   screen's own when they clear it or leave the family.
 */
export function usePersonTheme(): void {
  const personId = useThemeStore((s) => s.person?.memberId ?? null);
  const revertMinutes = useFamilyData()?.themeRevertMinutes ?? 0;
  const members = useFamilyMembers();
  const member = personId
    ? members.find((candidate) => candidate.id === personId)
    : undefined;
  const memberTheme = member?.theme ?? null;
  const needsPacks = memberTheme?.startsWith("pack:") ?? false;
  const packs = useThemePacks({
    enabled: personId !== null && needsPacks,
  }).data;
  const show = useShowMemberTheme();

  useEffect(() => {
    if (!personId || revertMinutes <= 0) return;
    const revertMs = revertMinutes * 60_000;
    const revert = () => useThemeStore.getState().showPerson(null);
    const since = useThemeStore.getState().person?.lastActiveAt ?? Date.now();
    const remaining = since + revertMs - Date.now();
    if (remaining <= 0) {
      revert();
      return;
    }

    let timer = window.setTimeout(revert, remaining);
    let lastWrite = 0;
    const onActivity = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(revert, revertMs);
      const now = Date.now();
      if (now - lastWrite >= ACTIVITY_WRITE_MS) {
        lastWrite = now;
        useThemeStore.getState().notePersonActivity(now);
      }
    };
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }
    return () => {
      window.clearTimeout(timer);
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity);
      }
    };
  }, [personId, revertMinutes]);

  useEffect(() => {
    const current = useThemeStore.getState().person;
    if (!personId || !current) return;
    if (!member) {
      // Gone from the family (once the family has loaded at all).
      if (members.length > 0) useThemeStore.getState().showPerson(null);
      return;
    }
    if (!memberTheme) {
      useThemeStore.getState().showPerson(null);
      return;
    }
    if (needsPacks && !packs) return;
    const wanted = memberThemeSelection(memberTheme, packs ?? []);
    if (!wanted) {
      useThemeStore.getState().showPerson(null);
      return;
    }
    if (!sameSelection(wanted, current.selection)) {
      void show(member, { keepActivity: true });
    }
  }, [personId, member, members.length, memberTheme, needsPacks, packs, show]);
}
