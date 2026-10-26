import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { format } from "date-fns";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { type FamilyApiResponse, familyKeys } from "@/api";
import type { FamilyData } from "@/lib/types";
import { setupMswServer } from "@/test/mocks/server";
import { useCalendarEvents } from "./use-calendar";

const FAMILY: FamilyData = {
  id: "family-1",
  name: "Birthday Family",
  timezone: "America/Los_Angeles",
  members: [
    {
      id: "m1",
      name: "Maya",
      color: "teal",
      birthday: { month: 10, day: 28, year: 2016 },
    },
    { id: "m2", name: "Dad", color: "coral", birthday: null },
  ],
  createdAt: "2025-01-01T00:00:00.000Z",
};

function wrapperWithFamily(family: FamilyData) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
  client.setQueryData<FamilyApiResponse>(familyKeys.family(), { data: family });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useCalendarEvents with birthdays", () => {
  setupMswServer();

  it("adds members' birthdays in the range as read-only all-day entries", async () => {
    const { result } = renderHook(
      () =>
        useCalendarEvents({ startDate: "2026-10-25", endDate: "2026-10-31" }),
      { wrapper: wrapperWithFamily(FAMILY) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const birthdays = (result.current.data?.data ?? []).filter(
      (e) => e.source === "BIRTHDAY",
    );
    expect(
      birthdays.map((e) => [e.title, format(e.date, "yyyy-MM-dd"), e.memberId]),
    ).toEqual([["Maya's birthday (turns 10)", "2026-10-28", "m1"]]);
  });
});
