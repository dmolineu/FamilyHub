import { useState } from "react";
import { useFamilyMemberById, useSetMemberTheme, useThemePacks } from "@/api";
import { memberThemeSelection, memberThemeValue } from "@/lib/member-theme";
import {
  type AppliedPack,
  BUILT_IN_THEMES,
  getBuiltInTheme,
  packPreview,
  type ThemePreview,
  type ThemeSelection,
} from "@/lib/themes";
import type { ThemePackSummary } from "@/lib/types";
import { effectiveSelection, useThemeStore } from "@/stores/theme-store";
import { ThemeSwatchCard } from "./theme-swatch-card";

interface MemberThemeSectionProps {
  memberId: string;
}

/**
 * A member's own look, on their profile: the System Default (each screen keeps
 * its own look) or any built-in look or family theme pack. Tapping them at the
 * top of a screen, or their name in the menu, shows it on that screen. Saved
 * at once, for every screen; packs are kept by name, so re-importing a newer
 * version of a pack keeps the choice.
 */
export function MemberThemeSection({ memberId }: MemberThemeSectionProps) {
  const member = useFamilyMemberById(memberId);
  const packsQuery = useThemePacks();
  const packs = packsQuery.data ?? [];
  const appliedPacks = useThemeStore((s) => s.appliedPacks);
  // The screen's own look (ignoring anyone shown over it), for the System Default card.
  const screenLook = useThemeStore((s) =>
    effectiveSelection({ ...s, person: null }),
  );
  const setTheme = useSetMemberTheme();
  // Shown checked while saving, so the tap answers at once.
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  if (!member) return null;

  const theme = pending !== undefined ? pending : (member.theme ?? null);
  // A pack theme cannot be matched until the family's packs have loaded.
  const waitingForPacks = theme?.startsWith("pack:") && !packsQuery.data;
  const current = waitingForPacks
    ? undefined
    : memberThemeSelection(theme, packs);
  const groupName = `member-theme-${memberId}`;

  const choose = (selection: ThemeSelection | null) => {
    const value = memberThemeValue(selection, packs);
    setError(null);
    setPending(value);
    setTheme.mutate(
      { id: memberId, theme: value },
      {
        onSettled: () => setPending(undefined),
        onError: (failure) => setError(failure.message),
      },
    );
  };

  const isSelected = (selection: ThemeSelection) =>
    current?.kind === selection.kind && current.id === selection.id;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Theme
      </h3>
      <p className="text-sm text-muted-foreground">
        Tapping {member.name}'s picture at the top of a screen, or their name in
        the menu, shows this look on that screen.
      </p>
      <div
        role="radiogroup"
        aria-label={`${member.name}'s theme`}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        <ThemeSwatchCard
          groupName={groupName}
          name="System Default"
          description="Each screen keeps its own look"
          dark={systemDark(screenLook, packs)}
          preview={systemPreview(screenLook, packs, appliedPacks)}
          selected={current === null}
          onSelect={() => choose(null)}
        />
        {BUILT_IN_THEMES.map((look) => (
          <ThemeSwatchCard
            key={look.id}
            groupName={groupName}
            name={look.name}
            description={look.description}
            dark={look.dark}
            preview={look.preview}
            selected={isSelected({ kind: "builtin", id: look.id })}
            onSelect={() => choose({ kind: "builtin", id: look.id })}
          />
        ))}
        {packs.map((pack) => (
          <ThemeSwatchCard
            key={pack.id}
            groupName={groupName}
            name={pack.name}
            description="Imported theme pack"
            dark={pack.dark}
            preview={packPreview(pack, appliedPacks[pack.id])}
            selected={isSelected({ kind: "pack", id: pack.id })}
            onSelect={() => choose({ kind: "pack", id: pack.id })}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

function systemDark(
  look: ThemeSelection,
  packs: ReadonlyArray<ThemePackSummary>,
): boolean {
  if (look.kind === "builtin") return getBuiltInTheme(look.id).dark;
  return packs.find((pack) => pack.id === look.id)?.dark ?? false;
}

function systemPreview(
  look: ThemeSelection,
  packs: ReadonlyArray<ThemePackSummary>,
  appliedPacks: Record<string, AppliedPack>,
): ThemePreview {
  if (look.kind === "builtin") return getBuiltInTheme(look.id).preview;
  const summary = packs.find((pack) => pack.id === look.id);
  return summary
    ? packPreview(summary, appliedPacks[look.id])
    : getBuiltInTheme("default").preview;
}
