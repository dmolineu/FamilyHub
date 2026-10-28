import { describe, expect, it } from "vitest";
import { SCREENSAVER_STORAGE_KEY } from "@/lib/constants";
import { DEFAULT_NIGHT, useScreensaverStore } from "./screensaver-store";

async function rehydrateWith(stored: unknown) {
  localStorage.setItem(
    SCREENSAVER_STORAGE_KEY,
    JSON.stringify({ state: stored, version: 0 }),
  );
  await useScreensaverStore.persist.rehydrate();
  return useScreensaverStore.getState();
}

describe("screensaver store", () => {
  it("keeps this device's night hours across a reload", async () => {
    const state = await rehydrateWith({
      delay: 10,
      night: { enabled: true, from: "21:00", to: "07:00" },
    });
    expect(state.delay).toBe(10);
    expect(state.night).toEqual({ enabled: true, from: "21:00", to: "07:00" });
  });

  it("falls back to the default hours for a broken saved value", async () => {
    const state = await rehydrateWith({
      delay: "auto",
      night: { enabled: true, from: "9pm", to: "07:00" },
    });
    expect(state.night).toEqual(DEFAULT_NIGHT);
  });
});
