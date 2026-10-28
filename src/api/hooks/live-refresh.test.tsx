import {
  QueryClient,
  QueryClientProvider,
  type QueryKey,
} from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { LIVE_REFRESH_MS } from "@/api/live-refresh";
import { server } from "@/test/mocks/server";
import { calendarKeys, useCalendarEvents } from "./use-calendar";
import { choreKeys, useChoresBoard } from "./use-chores";
import { familyKeys, useFamily } from "./use-family";
import { listsKeys, useList, useLists } from "./use-lists";
import { mealsKeys, useMealsBoard } from "./use-meals";

/**
 * A wall left on one screen must pick up what phones change without anyone touching
 * it, so the shared family data refetches on a timer (React Query pauses it while the
 * page is hidden, which spares phones' batteries).
 */
describe("live refresh of shared family data", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  function intervalFor(useHook: () => unknown, key: QueryKey) {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { unmount } = renderHook(useHook, { wrapper });
    const query = client.getQueryCache().find({ queryKey: key, exact: true });
    const interval = query?.observers[0]?.options.refetchInterval;
    unmount();
    client.clear();
    return interval;
  }

  const params = { startDate: "2026-10-25", endDate: "2026-10-31" };
  const listId = "00000000-0000-4000-8000-000000000101";

  it.each([
    [
      "calendar events",
      () => useCalendarEvents(params),
      calendarKeys.eventList(params),
    ],
    ["the chore board", () => useChoresBoard(), choreKeys.board()],
    ["the lists", () => useLists(), listsKeys.hub()],
    ["an open list", () => useList(listId), listsKeys.detail(listId)],
    [
      "the meal board",
      () => useMealsBoard("2026-10-25"),
      mealsKeys.board("2026-10-25"),
    ],
    ["the family", () => useFamily(), familyKeys.family()],
  ])("refetches %s every minute", (_name, useHook, key) => {
    expect(intervalFor(useHook, key)).toBe(LIVE_REFRESH_MS);
  });

  it("is once a minute", () => {
    expect(LIVE_REFRESH_MS).toBe(60_000);
  });
});
