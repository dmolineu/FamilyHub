import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBackHandler } from "@/hooks";

interface UnsavedChangesGuardOptions {
  /** True while the surface holds edits that have not been saved. */
  isDirty: boolean;
  /** Really closes the surface (the caller's onOpenChange(false)). */
  onClose: () => void;
  /** Throws the draft away before closing, for state that outlives the surface. */
  onDiscard?: () => void;
}

interface UnsavedChangesGuard {
  /** Use for Close, Cancel and any other way out: asks first when dirty. */
  requestClose: () => void;
  /** Drop-in for a dialog's onOpenChange, so drags, Escape and outside taps ask too. */
  guardOpenChange: (open: boolean) => void;
  /** Render this next to the surface. */
  dialog: ReactNode;
  /**
   * True while the question is on screen; pass to a MobileSheet so closing the
   * question cannot cascade into dismissing the sheet underneath it.
   */
  nestedDialogOpenRef: RefObject<boolean>;
}

/**
 * Asks "Discard unsaved changes?" before a settings surface closes with edits
 * in it, so a stray tap on the wall or a swipe on a phone never throws work
 * away silently. Keep editing returns to the form with everything intact.
 * While dirty, a reload or tab close also asks (the browser's own prompt).
 */
export function useUnsavedChangesGuard({
  isDirty,
  onClose,
  onDiscard,
}: UnsavedChangesGuardOptions): UnsavedChangesGuard {
  const [isAsking, setAsking] = useState(false);
  const nestedDialogOpenRef = useRef(false);

  // Reset after render, not on click: the question's own close runs Radix
  // cleanups that can reach the sheet below, and they must still see "open".
  useEffect(() => {
    if (!isAsking) nestedDialogOpenRef.current = false;
  }, [isAsking]);

  useBackHandler(isAsking, () => setAsking(false));

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers need returnValue set to show the prompt.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const requestClose = useCallback(() => {
    if (nestedDialogOpenRef.current) return;
    if (isDirty) {
      nestedDialogOpenRef.current = true;
      setAsking(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const guardOpenChange = useCallback(
    (open: boolean) => {
      if (!open) requestClose();
    },
    [requestClose],
  );

  const discard = () => {
    setAsking(false);
    onDiscard?.();
    onClose();
  };

  const dialog = (
    <Dialog
      open={isAsking}
      onOpenChange={(open) => {
        if (!open) setAsking(false);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Discard unsaved changes?</DialogTitle>
          <DialogDescription>
            Your changes haven't been saved. If you leave now, they'll be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            autoFocus
            onClick={() => setAsking(false)}
          >
            Keep editing
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="min-h-11"
            onClick={discard}
          >
            Discard changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { requestClose, guardOpenChange, dialog, nestedDialogOpenRef };
}
