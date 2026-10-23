import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { testWeather } from "@/test/fixtures/weather";
import { seedMockWeather } from "@/test/mocks/handlers";
import { setupMswServer } from "@/test/mocks/server";
import { useWeather } from "./use-weather";

setupMswServer();

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useWeather", () => {
  it("returns the forecast when the family has a location", async () => {
    seedMockWeather(testWeather);

    const { result } = renderHook(() => useWeather(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.location).toBe("San Diego, California");
    expect(result.current.data?.data.current.temperature).toBe(72);
  });

  it("resolves to nothing while no location is set (204)", async () => {
    const { result } = renderHook(() => useWeather(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
