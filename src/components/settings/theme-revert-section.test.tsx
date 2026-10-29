import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { FamilyMember, UpdateFamilyRequest } from "@/lib/types";
import { API_BASE, server, setupMswServer } from "@/test/mocks/server";
import {
  renderWithUser,
  screen,
  seedFamilyStore,
  waitFor,
} from "@/test/test-utils";
import { ThemeRevertSection } from "./theme-revert-section";

setupMswServer();

const MOM: FamilyMember = { id: "mom", name: "Mom", color: "coral" };

describe("ThemeRevertSection", () => {
  let sent: UpdateFamilyRequest[];

  beforeEach(() => {
    seedFamilyStore({ name: "F", members: [MOM] });
    sent = [];
    server.use(
      http.put(`${API_BASE}/family`, async ({ request }) => {
        const body = (await request.json()) as UpdateFamilyRequest;
        sent.push(body);
        return HttpResponse.json({
          data: {
            id: "f",
            name: "F",
            members: [MOM],
            createdAt: "2026-10-28T00:00:00Z",
            themeRevertMinutes: body.themeRevertMinutes ?? 0,
          },
        });
      }),
    );
  });

  it("offers Never, 5 minutes, 15 minutes and 1 hour, starting at Never", () => {
    renderWithUser(<ThemeRevertSection />);

    const select = screen.getByLabelText("Revert to System Default Theme");
    expect(select).toHaveDisplayValue("Never");
    expect(
      Array.from(select.querySelectorAll("option")).map((o) => o.textContent),
    ).toEqual(["Never", "5 minutes", "15 minutes", "1 hour"]);
  });

  it("saves the family's choice for every screen", async () => {
    const { user } = renderWithUser(<ThemeRevertSection />);

    await user.selectOptions(
      screen.getByLabelText("Revert to System Default Theme"),
      "15 minutes",
    );

    await waitFor(() => expect(sent).toEqual([{ themeRevertMinutes: 15 }]));
    expect(
      screen.getByLabelText("Revert to System Default Theme"),
    ).toHaveDisplayValue("15 minutes");
  });

  it("shows the family's current choice", () => {
    seedFamilyStore({ name: "F", members: [MOM], themeRevertMinutes: 60 });
    renderWithUser(<ThemeRevertSection />);

    expect(
      screen.getByLabelText("Revert to System Default Theme"),
    ).toHaveDisplayValue("1 hour");
  });
});
