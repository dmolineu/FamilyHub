import { Bell, X } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { useUnsavedChangesGuard } from "@/components/ui/unsaved-changes-dialog";
import { cn } from "@/lib/utils";
import { BackupTab } from "./backup-tab";
import { FamilyInboxSection } from "./family-inbox-section";
import { FamilyTab } from "./family-tab";
import { ParentLock } from "./parent-lock";
import { PhotoSourceSection } from "./photo-source-section";
import { PhotoStorageSection } from "./photo-storage-section";
import { ScreenTab } from "./screen-tab";
import { SignInPasswordSection } from "./sign-in-password-section";
import { WeatherSportsTab } from "./weather-sports-tab";

type SettingsTabId =
  | "family"
  | "screen"
  | "weather"
  | "photos"
  | "accounts"
  | "backup";

const TABS: ReadonlyArray<{ id: SettingsTabId; label: string }> = [
  { id: "family", label: "Family" },
  { id: "screen", label: "This screen" },
  { id: "weather", label: "Weather & Sports" },
  { id: "photos", label: "Photos" },
  { id: "accounts", label: "Accounts" },
  { id: "backup", label: "Backup" },
];

const COMING_SOON_ROWS = [{ icon: Bell, label: "Notifications" }] as const;

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Every setting in one screen, behind one parent PIN, in tabs: the family, this
 * screen (per device), weather and sports, photos, accounts, and backup. All the
 * tabs stay mounted while it is open, so a half-typed entry on one tab survives
 * a look at another, and closing with one anywhere asks first.
 */
export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const [tab, setTab] = useState<SettingsTabId>("family");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Each opening starts on Family, whatever tab the last person left it on.
  useEffect(() => {
    if (open) setTab("family");
  }, [open]);

  // Unsaved drafts: the family name, a weather location and a new password.
  // Remounting their sections (a new key) is how a discard clears them.
  const [familyDirty, setFamilyDirty] = useState(false);
  const [weatherDirty, setWeatherDirty] = useState(false);
  const [passwordDirty, setPasswordDirty] = useState(false);
  const [draftsKey, setDraftsKey] = useState(0);
  const forgetDrafts = () => {
    setFamilyDirty(false);
    setWeatherDirty(false);
    setPasswordDirty(false);
  };
  const guard = useUnsavedChangesGuard({
    isDirty: familyDirty || weatherDirty || passwordDirty,
    onClose: () => onOpenChange(false),
    onDiscard: () => {
      forgetDrafts();
      setDraftsKey((key) => key + 1);
    },
  });

  const moveWithArrows = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + TABS.length) % TABS.length;
    setTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  const panel = (id: SettingsTabId, children: ReactNode) => (
    <div
      role="tabpanel"
      id={`settings-panel-${id}`}
      aria-labelledby={`settings-tab-${id}`}
      hidden={tab !== id}
      className="space-y-8 py-4"
    >
      {children}
    </div>
  );

  return (
    <>
      <ResponsiveFormDialog
        open={open}
        onOpenChange={(next) =>
          next ? onOpenChange(true) : guard.requestClose()
        }
        mobileNestedDialogOpenRef={guard.nestedDialogOpenRef}
        title="Settings"
        initialHeight="full"
        dialogClassName="max-w-lg"
        titleClassName="text-xl"
        desktopHeaderRight={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={guard.requestClose}
            className="h-11 w-11"
          >
            <X className="h-4 w-4" />
          </Button>
        }
      >
        {/* Locking unmounts the tabs, which takes away any dialog a parent had
          open from them and the drafts with it. */}
        <ParentLock
          isOpen={open}
          prompt="Who is changing the settings?"
          onLock={forgetDrafts}
        >
          {/* Stays in view while a long tab scrolls; the tabs scroll sideways
            on a narrow phone. */}
          <div
            role="tablist"
            aria-label="Settings sections"
            className="sticky top-0 z-10 -mx-1 mt-2 flex gap-1 overflow-x-auto bg-card px-1 py-2"
          >
            {TABS.map(({ id, label }, index) => (
              <button
                key={id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                id={`settings-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={tab === id}
                aria-controls={`settings-panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={(event) => moveWithArrows(event, index)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
                  tab === id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {panel(
            "family",
            <FamilyTab key={draftsKey} onDirtyChange={setFamilyDirty} />,
          )}
          {panel("screen", <ScreenTab />)}
          {panel(
            "weather",
            <WeatherSportsTab
              key={draftsKey}
              onDirtyChange={setWeatherDirty}
            />,
          )}
          {panel(
            "photos",
            <>
              <PhotoStorageSection />
              <PhotoSourceSection />
            </>,
          )}
          {panel(
            "accounts",
            <>
              <FamilyInboxSection />
              <SignInPasswordSection
                key={draftsKey}
                onDirtyChange={setPasswordDirty}
              />
              <ComingSoonSection />
            </>,
          )}
          {panel(
            "backup",
            <BackupTab onFamilyReset={() => onOpenChange(false)} />,
          )}
        </ParentLock>
      </ResponsiveFormDialog>
      {guard.dialog}
    </>
  );
}

function ComingSoonSection() {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Coming Soon
      </h3>
      <div className="space-y-1">
        {COMING_SOON_ROWS.map((row) => {
          const Icon = row.icon;
          return (
            <button
              key={row.label}
              type="button"
              disabled
              aria-disabled="true"
              className="w-full min-h-11 flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-muted-foreground opacity-60 cursor-not-allowed"
            >
              <Icon className="h-5 w-5" />
              {row.label}
              <span className="ml-auto text-xs font-normal rounded-full border border-border px-2 py-0.5">
                Coming soon
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
