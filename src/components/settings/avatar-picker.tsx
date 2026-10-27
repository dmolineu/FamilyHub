import { ArrowLeft, ImageUp } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useAvatarPackDocuments, useAvatarPacks } from "@/api";
import { MemberAvatar } from "@/components/calendar/components/member-avatar";
import { Button } from "@/components/ui/button";
import { characterAvatar } from "@/lib/avatar-images";
import { BUILT_IN_AVATARS, BUILT_IN_PREFIX } from "@/lib/avatars";
import type { AvatarCharacter, FamilyMember } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AvatarPhotoCropper } from "./avatar-photo-cropper";

type Tab = "characters" | "pictures" | "photo";

const TABS: { id: Tab; label: string }[] = [
  { id: "characters", label: "Characters" },
  { id: "pictures", label: "Pictures" },
  { id: "photo", label: "Photo" },
];

/** Photos are shrunk to 256 px here, so only absurd files are refused outright. */
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

interface AvatarPickerProps {
  member: FamilyMember;
  /** Called with the avatar to save, or null to go back to the initial. */
  onChoose: (avatar: string | null) => void;
  onBack: () => void;
  saving?: boolean;
  error?: string | null;
}

/**
 * Chooses a member's picture: a character from the family's packs, a picture drawn for
 * the app, or a photo framed in the circle. Large tiles, so it works by touch on the
 * wall as well as with a mouse.
 */
export function AvatarPicker({
  member,
  onChoose,
  onBack,
  saving = false,
  error,
}: AvatarPickerProps) {
  const packs = useAvatarPacks();
  const summaries = packs.data ?? [];
  const documents = useAvatarPackDocuments(summaries);
  const [tab, setTab] = useState<Tab | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();

  // Characters first once the family has any; until the list arrives, pictures.
  const activeTab: Tab =
    tab ?? (summaries.length > 0 ? "characters" : "pictures");
  const busy = saving || preparing;
  const shownError = localError ?? error ?? null;

  const chooseCharacter = async (character: AvatarCharacter) => {
    setLocalError(null);
    setPreparing(true);
    try {
      onChoose(await characterAvatar(character.image));
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "That character could not be used",
      );
    } finally {
      setPreparing(false);
    }
  };

  const onPhotoPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalError("Please choose a photo (an image file).");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setLocalError("That photo is over 25 MB; please choose a smaller one.");
      return;
    }
    setLocalError(null);
    setPhoto(file);
  };

  if (photo) {
    return (
      <div className="space-y-4 py-2">
        <h3 className="text-base font-semibold text-center">
          Frame the photo for {member.name}
        </h3>
        <AvatarPhotoCropper
          file={photo}
          onCancel={() => setPhoto(null)}
          onDone={(avatar) => {
            setPhoto(null);
            onChoose(avatar);
          }}
        />
      </div>
    );
  }

  const groupedCharacters = documents.packs.flatMap(({ summary, document }) => {
    const groups = new Map<string, AvatarCharacter[]>();
    for (const character of document.characters) {
      const group = character.group ?? document.name;
      groups.set(group, [...(groups.get(group) ?? []), character]);
    }
    return [...groups.entries()].map(([group, characters]) => ({
      id: `${summary.id}:${group}`,
      group,
      characters,
    }));
  });

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="h-11 gap-1 px-3"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h3 className="text-base font-semibold">
          Choose a picture for {member.name}
        </h3>
      </div>

      <div
        role="tablist"
        aria-label="Kind of picture"
        className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`${baseId}-${id}-tab`}
            aria-selected={activeTab === id}
            aria-controls={`${baseId}-${id}-panel`}
            onClick={() => setTab(id)}
            className={cn(
              "h-11 rounded-lg text-sm font-medium transition-colors",
              activeTab === id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {shownError && (
        <p role="alert" className="text-sm text-destructive">
          {shownError}
        </p>
      )}

      <div
        role="tabpanel"
        id={`${baseId}-${activeTab}-panel`}
        aria-labelledby={`${baseId}-${activeTab}-tab`}
        className="max-h-[55vh] overflow-y-auto overscroll-contain"
      >
        {activeTab === "characters" &&
          (packs.isLoading || documents.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading characters…
            </p>
          ) : groupedCharacters.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No characters yet. A parent can import a character pack in Family
              Settings.
            </p>
          ) : (
            <div className="space-y-5">
              {groupedCharacters.map(({ id, group, characters }) => (
                <section key={id} aria-label={group}>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </h4>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {characters.map((character) => (
                      <button
                        key={character.key}
                        type="button"
                        disabled={busy}
                        onClick={() => chooseCharacter(character)}
                        className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card p-2 text-xs font-medium hover:bg-muted active:scale-[0.97] disabled:opacity-50"
                      >
                        <img
                          src={character.image}
                          alt=""
                          draggable={false}
                          className="h-14 w-14 rounded-full object-cover"
                        />
                        {character.name}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ))}

        {activeTab === "pictures" && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {BUILT_IN_AVATARS.map((avatar) => {
              const value = `${BUILT_IN_PREFIX}${avatar.key}`;
              return (
                <button
                  key={avatar.key}
                  type="button"
                  disabled={busy}
                  aria-pressed={member.avatarUrl === value}
                  onClick={() => onChoose(value)}
                  className={cn(
                    "flex min-h-24 flex-col items-center justify-center gap-1 rounded-xl border bg-card p-2 text-xs font-medium hover:bg-muted active:scale-[0.97] disabled:opacity-50",
                    member.avatarUrl === value
                      ? "border-primary ring-2 ring-primary"
                      : "border-border",
                  )}
                >
                  <MemberAvatar
                    name={member.name}
                    color={member.color}
                    avatarUrl={value}
                    className="h-14 w-14"
                  />
                  {avatar.name}
                </button>
              );
            })}
          </div>
        )}

        {activeTab === "photo" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Take or choose a photo; you can move and zoom it to fit the
              circle.
            </p>
            <Button
              type="button"
              className="h-11 gap-2"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageUp className="h-4 w-4" />
              Choose a photo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPhotoPicked}
              className="hidden"
              aria-label="Choose a photo"
            />
          </div>
        )}
      </div>

      {member.avatarUrl && (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          disabled={busy}
          onClick={() => onChoose(null)}
        >
          Use initials
        </Button>
      )}
    </div>
  );
}
