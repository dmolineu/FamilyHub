import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import type { ThemePackDocument } from "@/lib/types";
import { useThemeStore } from "@/stores/theme-store";
import {
  API_BASE,
  seedMockThemePacks,
  server,
  setupMswServer,
} from "@/test/mocks/server";
import {
  useDeleteThemePack,
  useExportThemePack,
  useImportThemePack,
  useSelectThemePack,
  useThemePacks,
} from "./use-theme-packs";

const PNG_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const PADRES: ThemePackDocument = {
  version: 1,
  name: "Padres",
  dark: true,
  tokens: { "--background": "#2f241d", "--primary": "#ffc425" },
  images: { logo: PNG_PIXEL },
  slots: { headerLogo: "logo" },
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

describe("theme pack hooks", () => {
  setupMswServer();

  beforeEach(() => {
    useThemeStore.setState({
      selection: { kind: "builtin", id: "default" },
      appliedPack: null,
    });
  });

  it("lists the family's packs", async () => {
    seedMockThemePacks([PADRES]);
    const { result } = renderHook(() => useThemePacks(), {
      wrapper: createWrapper(createClient()),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((p) => p.name)).toEqual(["Padres"]);
    expect(result.current.data?.[0].dark).toBe(true);
  });

  it("imports a pack and refreshes the list", async () => {
    const client = createClient();
    const wrapper = createWrapper(client);
    const list = renderHook(() => useThemePacks(), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    expect(list.result.current.data).toEqual([]);

    const { result } = renderHook(() => useImportThemePack(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(PADRES);
    });
    await waitFor(() =>
      expect(list.result.current.data?.map((p) => p.name)).toEqual(["Padres"]),
    );
  });

  it("selecting a pack fetches its document, caches it on this device and switches the look", async () => {
    seedMockThemePacks([PADRES]);
    const wrapper = createWrapper(createClient());
    const list = renderHook(() => useThemePacks(), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    const summary = list.result.current.data?.[0];
    if (!summary) throw new Error("no pack listed");

    const { result } = renderHook(() => useSelectThemePack(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(summary);
    });

    const state = useThemeStore.getState();
    expect(state.selection).toEqual({ kind: "pack", id: summary.id });
    expect(state.appliedPack).toMatchObject({
      id: summary.id,
      name: "Padres",
      dark: true,
      tokens: PADRES.tokens,
      images: PADRES.images,
      slots: PADRES.slots,
    });
    expect(state.resolved).toEqual({ theme: "pack", dark: true });
  });

  it("exporting a pack returns the document exactly as stored", async () => {
    seedMockThemePacks([PADRES]);
    const wrapper = createWrapper(createClient());
    const list = renderHook(() => useThemePacks(), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    const id = list.result.current.data?.[0].id ?? "";

    const { result } = renderHook(() => useExportThemePack(), { wrapper });
    let document: ThemePackDocument | undefined;
    await act(async () => {
      document = await result.current.mutateAsync(id);
    });
    expect(document).toEqual(PADRES);
  });

  it("deleting the pack this device shows falls back to the Default look", async () => {
    seedMockThemePacks([PADRES]);
    const client = createClient();
    const wrapper = createWrapper(client);
    const list = renderHook(() => useThemePacks(), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    const summary = list.result.current.data?.[0];
    if (!summary) throw new Error("no pack listed");

    const select = renderHook(() => useSelectThemePack(), { wrapper });
    await act(async () => {
      await select.result.current.mutateAsync(summary);
    });
    expect(useThemeStore.getState().resolved.theme).toBe("pack");

    const remove = renderHook(() => useDeleteThemePack(), { wrapper });
    await act(async () => {
      await remove.result.current.mutateAsync(summary.id);
    });
    await waitFor(() => expect(list.result.current.data).toEqual([]));
    expect(useThemeStore.getState().selection).toEqual({
      kind: "builtin",
      id: "default",
    });
    expect(useThemeStore.getState().appliedPack).toBeNull();
  });

  it("surfaces the server's reason when an import is rejected", async () => {
    server.use(
      http.post(`${API_BASE}/theme-packs`, () =>
        HttpResponse.json(
          { message: "Theme pack token --evil has an unsafe value" },
          { status: 400 },
        ),
      ),
    );
    const { result } = renderHook(() => useImportThemePack(), {
      wrapper: createWrapper(createClient()),
    });
    await expect(
      act(async () => {
        await result.current.mutateAsync({ ...PADRES, name: "Bad" });
      }),
    ).rejects.toThrow(/unsafe value/);
  });
});
