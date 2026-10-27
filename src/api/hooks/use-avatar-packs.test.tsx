import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { AvatarPackDocument } from "@/lib/types";
import { seedMockAvatarPacks, setupMswServer } from "@/test/mocks/server";
import {
  useAvatarPackDocuments,
  useAvatarPacks,
  useDeleteAvatarPack,
  useImportAvatarPack,
} from "./use-avatar-packs";

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const CHARACTERS: AvatarPackDocument = {
  version: 1,
  name: "Characters",
  characters: [
    { key: "pikachu", name: "Pikachu", group: "Pokémon", image: PNG },
    { key: "yoda", name: "Yoda", group: "Star Wars", image: PNG },
  ],
};

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

describe("avatar pack hooks", () => {
  setupMswServer();

  it("lists the family's packs without their pictures", async () => {
    seedMockAvatarPacks([CHARACTERS]);
    const { result } = renderHook(() => useAvatarPacks(), {
      wrapper: createWrapper(createClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      expect.objectContaining({
        name: "Characters",
        characterCount: 2,
        groups: ["Pokémon", "Star Wars"],
      }),
    ]);
  });

  it("fetches every pack's characters for the picker", async () => {
    seedMockAvatarPacks([CHARACTERS]);
    const client = createClient();
    const { result } = renderHook(
      () => {
        const packs = useAvatarPacks();
        return useAvatarPackDocuments(packs.data ?? []);
      },
      { wrapper: createWrapper(client) },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.packs).toHaveLength(1));
    expect(result.current.packs[0].document.characters[1].name).toBe("Yoda");
  });

  it("imports a pack and refreshes the list", async () => {
    const client = createClient();
    const { result } = renderHook(
      () => ({ packs: useAvatarPacks(), importPack: useImportAvatarPack() }),
      { wrapper: createWrapper(client) },
    );
    await waitFor(() => expect(result.current.packs.isSuccess).toBe(true));
    expect(result.current.packs.data).toEqual([]);

    await act(() => result.current.importPack.mutateAsync(CHARACTERS));

    await waitFor(() => expect(result.current.packs.data).toHaveLength(1));
  });

  it("deletes a pack and refreshes the list", async () => {
    seedMockAvatarPacks([CHARACTERS]);
    const client = createClient();
    const { result } = renderHook(
      () => ({ packs: useAvatarPacks(), remove: useDeleteAvatarPack() }),
      { wrapper: createWrapper(client) },
    );
    await waitFor(() => expect(result.current.packs.data).toHaveLength(1));
    const id = result.current.packs.data?.[0].id ?? "";

    await act(() => result.current.remove.mutateAsync(id));

    await waitFor(() => expect(result.current.packs.data).toEqual([]));
  });
});
