import { useState } from "react";
import { useAddRecipePack, useRecipePacks } from "@/api";
import { Button } from "@/components/ui/button";
import { MobileSheet } from "@/components/ui/mobile-sheet";

interface RecipePacksSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The bundled recipe packs, each with an Add button. Adding is safe to repeat:
 * titles already in the library are skipped and the card says so.
 */
export function RecipePacksSheet({ isOpen, onClose }: RecipePacksSheetProps) {
  const packs = useRecipePacks(isOpen);
  const [results, setResults] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const addPack = useAddRecipePack();

  const add = (id: string) => {
    setPendingId(id);
    addPack.mutate(id, {
      onSuccess: (response) => {
        const { added, skipped } = response.data;
        setResults((current) => ({
          ...current,
          [id]:
            added > 0
              ? `Added ${added} recipe${added === 1 ? "" : "s"}${
                  skipped > 0 ? ` (${skipped} already there)` : ""
                }.`
              : "These recipes are already in your library.",
        }));
      },
      onError: (error) => {
        setResults((current) => ({ ...current, [id]: error.message }));
      },
      onSettled: () => setPendingId(null),
    });
  };

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Recipe packs"
      initialHeight="half"
    >
      <div className="space-y-3 py-2">
        {packs.isLoading && (
          <p className="text-sm text-muted-foreground">Loading packs…</p>
        )}
        {packs.isError && (
          <p className="text-sm text-destructive">
            Recipe packs could not be loaded.
          </p>
        )}
        {(packs.data ?? []).map((pack) => (
          <article
            key={pack.id}
            aria-label={pack.name}
            className="space-y-2 rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground">{pack.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {pack.description}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {pack.recipeCount} recipes
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={pendingId === pack.id}
                onClick={() => add(pack.id)}
              >
                {pendingId === pack.id ? "Adding…" : "Add"}
              </Button>
            </div>
            {results[pack.id] && (
              <p role="status" className="text-sm text-muted-foreground">
                {results[pack.id]}
              </p>
            )}
          </article>
        ))}
      </div>
    </MobileSheet>
  );
}
