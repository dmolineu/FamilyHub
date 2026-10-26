import { HttpResponse, http } from "msw";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AUTH_TOKEN_STORAGE_KEY, FAMILY_STORAGE_KEY } from "@/lib/constants";
import * as activityStore from "@/lib/home-activity/store";
import * as offlinePersister from "@/lib/offline/persister";
import { queryClient } from "@/providers/query-client";
import { server } from "@/test/mocks/server";
import { createHttpClient, handleUnauthorized } from "./http-client";

// MSW server setup
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe("createHttpClient URL resolution", () => {
  it("preserves base URL path when endpoint has leading slash", async () => {
    // Handler at /api/family — if the /api prefix is dropped, this won't match
    server.use(
      http.get("http://localhost:9999/api/family", () => {
        return HttpResponse.json({ data: "ok" });
      }),
    );

    const client = createHttpClient({
      baseUrl: "http://localhost:9999/api",
    });

    const result = await client.get<{ data: string }>("/family");
    expect(result.data).toBe("ok");
  });

  it("works with endpoint without leading slash", async () => {
    server.use(
      http.get("http://localhost:9999/api/calendar/events", () => {
        return HttpResponse.json({ data: [] });
      }),
    );

    const client = createHttpClient({
      baseUrl: "http://localhost:9999/api",
    });

    const result = await client.get<{ data: unknown[] }>("calendar/events");
    expect(result.data).toEqual([]);
  });

  it("works when base URL already has trailing slash", async () => {
    server.use(
      http.get("http://localhost:9999/api/family", () => {
        return HttpResponse.json({ data: "ok" });
      }),
    );

    const client = createHttpClient({
      baseUrl: "http://localhost:9999/api/",
    });

    const result = await client.get<{ data: string }>("/family");
    expect(result.data).toBe("ok");
  });
});

describe("createHttpClient relative base URL resolution", () => {
  // jsdom origin is http://localhost:3000 (from vitest.config.ts),
  // so "/api" resolves to "http://localhost:3000/api/"

  it("resolves relative base URL against window.location.origin", async () => {
    server.use(
      http.get("http://localhost:3000/api/family", () => {
        return HttpResponse.json({ data: "ok" });
      }),
    );

    const client = createHttpClient({ baseUrl: "/api" });

    const result = await client.get<{ data: string }>("/family");
    expect(result.data).toBe("ok");
  });

  it("resolves relative base URL with trailing slash", async () => {
    server.use(
      http.get("http://localhost:3000/api/family", () => {
        return HttpResponse.json({ data: "ok" });
      }),
    );

    const client = createHttpClient({ baseUrl: "/api/" });

    const result = await client.get<{ data: string }>("/family");
    expect(result.data).toBe("ok");
  });
});

describe("handleUnauthorized (401 session cleanup)", () => {
  const originalLocation = window.location;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("clears token, family storage, and offline cache before reloading", async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "token-123");
    localStorage.setItem(FAMILY_STORAGE_KEY, "family-blob");
    const clearSpy = vi
      .spyOn(offlinePersister, "clearOfflineReadCache")
      .mockResolvedValue(undefined);
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload },
    });

    await handleUnauthorized();

    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(FAMILY_STORAGE_KEY)).toBeNull();
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalled();
    // Offline cache must be cleared BEFORE the reload navigates away.
    expect(clearSpy.mock.invocationCallOrder[0]).toBeLessThan(
      reload.mock.invocationCallOrder[0],
    );
  });

  it("empties the in-memory query cache before wiping IndexedDB (no cross-account re-leak)", async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "token-123");
    const clearStorageSpy = vi
      .spyOn(offlinePersister, "clearOfflineReadCache")
      .mockResolvedValue(undefined);
    // Spy without clearing the real app singleton.
    const clearCacheSpy = vi
      .spyOn(queryClient, "clear")
      .mockImplementation(() => {});
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload },
    });

    await handleUnauthorized();

    expect(clearCacheSpy).toHaveBeenCalledTimes(1);
    // In-memory cache cleared BEFORE the IndexedDB wipe, so any late throttled
    // persist dehydrates an empty client rather than re-seeding account-A data.
    expect(clearCacheSpy.mock.invocationCallOrder[0]).toBeLessThan(
      clearStorageSpy.mock.invocationCallOrder[0],
    );
    // ...and both happen before the reload navigates away.
    expect(clearStorageSpy.mock.invocationCallOrder[0]).toBeLessThan(
      reload.mock.invocationCallOrder[0],
    );
  });

  it("does not reload on a first-visit 401 (no token) but still clears the offline cache", async () => {
    const clearSpy = vi
      .spyOn(offlinePersister, "clearOfflineReadCache")
      .mockResolvedValue(undefined);
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload },
    });

    await handleUnauthorized();

    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it("clears persisted home activity (store + markers) before the 401 reload", async () => {
    const offlineSpy = vi
      .spyOn(offlinePersister, "clearOfflineReadCache")
      .mockResolvedValue(undefined);
    const activitySpy = vi
      .spyOn(activityStore, "clearHomeActivity")
      .mockResolvedValue(undefined);
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload },
    });
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "token-123"); // token present → real session expiry → reloads
    await handleUnauthorized();
    expect(activitySpy).toHaveBeenCalled();
    expect(offlineSpy.mock.invocationCallOrder[0]).toBeLessThan(
      activitySpy.mock.invocationCallOrder[0],
    );
    expect(activitySpy.mock.invocationCallOrder[0]).toBeLessThan(
      reload.mock.invocationCallOrder[0],
    );
  });
});

describe("createHttpClient binary bodies", () => {
  it("uploads a file as its own content type with the auth header", async () => {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "token-123");
    let seen: {
      type: string | null;
      auth: string | null;
      size: number;
    } | null = null;
    server.use(
      http.post("http://localhost:9999/api/photos", async ({ request }) => {
        seen = {
          type: request.headers.get("Content-Type"),
          auth: request.headers.get("Authorization"),
          size: (await request.arrayBuffer()).byteLength,
        };
        return HttpResponse.json({ data: { id: "p1" } }, { status: 201 });
      }),
    );
    const client = createHttpClient({ baseUrl: "http://localhost:9999/api" });

    const result = await client.postBinary<{ data: { id: string } }>(
      "/photos",
      new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], {
        type: "image/jpeg",
      }),
    );

    expect(result.data.id).toBe("p1");
    expect(seen).toEqual({
      type: "image/jpeg",
      auth: "Bearer token-123",
      size: 4,
    });
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  });

  it("downloads an image as a Blob", async () => {
    server.use(
      http.get(
        "http://localhost:9999/api/photos/p1/content",
        () =>
          new HttpResponse(new Uint8Array([1, 2, 3]), {
            headers: { "Content-Type": "image/png" },
          }),
      ),
    );
    const client = createHttpClient({ baseUrl: "http://localhost:9999/api" });

    const blob = await client.getBlob("/photos/p1/content");

    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(3);
  });
});
