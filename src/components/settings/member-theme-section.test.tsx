import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { FamilyMember, ThemePackDocument } from "@/lib/types";
import { resetMockThemePacks, seedMockThemePacks } from "@/test/mocks/handlers";
import { API_BASE, server, setupMswServer } from "@/test/mocks/server";
import {
  renderWithUser,
  screen,
  seedFamilyStore,
  waitFor,
} from "@/test/test-utils";
import { MemberThemeSection } from "./member-theme-section";

setupMswServer();

const JEEP: ThemePackDocument = {
  version: 1,
  name: "Jeep (desert)",
  dark: false,
  tokens: { "--primary": "#b4532a" },
};
const MAYA: FamilyMember = { id: "maya", name: "Maya", color: "teal" };

describe("MemberThemeSection", () => {
  let sent: Array<{ theme: string | null }>;

  beforeEach(() => {
    resetMockThemePacks();
    seedMockThemePacks([JEEP]);
    seedFamilyStore({ members: [MAYA] });
    sent = [];
    server.use(
      http.put(
        `${API_BASE}/family/members/:id/theme`,
        async ({ params, request }) => {
          const body = (await request.json()) as { theme: string | null };
          sent.push(body);
          return HttpResponse.json({
            data: { ...MAYA, id: params.id, theme: body.theme },
          });
        },
      ),
    );
  });

  it("starts on the System Default", () => {
    renderWithUser(<MemberThemeSection memberId="maya" />);

    expect(screen.getByRole("radio", { name: /System Default/ })).toBeChecked();
  });

  it("saves a built-in look as the member's own", async () => {
    const { user } = renderWithUser(<MemberThemeSection memberId="maya" />);

    await user.click(screen.getByRole("radio", { name: /Midnight/ }));

    await waitFor(() => expect(sent).toEqual([{ theme: "builtin:midnight" }]));
    expect(screen.getByRole("radio", { name: /Midnight/ })).toBeChecked();
  });

  it("offers the family's packs and saves one by its name", async () => {
    const { user } = renderWithUser(<MemberThemeSection memberId="maya" />);

    await user.click(
      await screen.findByRole("radio", { name: /Jeep \(desert\)/ }),
    );

    await waitFor(() =>
      expect(sent).toEqual([{ theme: "pack:Jeep (desert)" }]),
    );
  });

  it("goes back to the System Default", async () => {
    seedFamilyStore({ members: [{ ...MAYA, theme: "builtin:sunrise" }] });
    const { user } = renderWithUser(<MemberThemeSection memberId="maya" />);
    expect(screen.getByRole("radio", { name: /Sunrise/ })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: /System Default/ }));

    await waitFor(() => expect(sent).toEqual([{ theme: null }]));
  });
});
