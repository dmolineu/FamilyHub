import { format } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  belongsToMember,
  eventMemberIds,
  matchesMemberFilter,
} from "./calendar-members";
import { sportsGameEvents } from "./sports-events";
import type { FollowedTeam, SportsGame } from "./types";

const PADRES: FollowedTeam = {
  id: "f-sd",
  league: "MLB",
  providerTeamId: "135",
  name: "San Diego Padres",
  shortName: "Padres",
  abbreviation: "SD",
  logoUrl: null,
  color: "#2f241d",
  showOnCalendar: true,
  hideScores: false,
  memberIds: ["dad", "leo"],
};

function game(partial: Partial<SportsGame>): SportsGame {
  return {
    id: "g1",
    providerGameId: "900001",
    league: "MLB",
    // 7:10 PM on 1 April in San Diego.
    startAt: "2027-04-02T02:10:00Z",
    timeTbd: false,
    home: {
      teamId: "135",
      name: "San Diego Padres",
      abbreviation: "SD",
      score: null,
      logoUrl: null,
    },
    away: {
      teamId: "119",
      name: "Los Angeles Dodgers",
      abbreviation: "LAD",
      score: null,
      logoUrl: null,
    },
    venue: "Petco Park",
    broadcasts: ["Padres.TV"],
    state: "SCHEDULED",
    detail: null,
    followedTeamIds: ["f-sd"],
    color: "#2f241d",
    memberIds: ["dad", "leo"],
    hideScores: false,
    ...partial,
  };
}

const LA = "America/Los_Angeles";

describe("sportsGameEvents", () => {
  it("puts a home game on its day in the family's zone, in every fan's lane", () => {
    const [event] = sportsGameEvents([game({})], [PADRES], new Set(), LA);

    expect(event.id).toBe("sports:g1");
    expect(event.source).toBe("SPORTS");
    expect(event.title).toBe("Padres vs Los Angeles Dodgers");
    expect(format(event.date, "yyyy-MM-dd")).toBe("2027-04-01");
    expect(event.startTime).toBe("7:10 PM");
    expect(event.endTime).toBe("10:10 PM");
    expect(event.isAllDay).toBe(false);
    expect(event.memberId).toBe("dad");
    expect(event.memberIds).toEqual(["dad", "leo"]);
    expect(event.location).toBe("Petco Park");
    expect(event.description).toBe("On Padres.TV");
  });

  it("names an away game from the followed team's side", () => {
    const [event] = sportsGameEvents(
      [
        game({
          home: {
            teamId: "119",
            name: "Los Angeles Dodgers",
            abbreviation: "LAD",
            score: null,
            logoUrl: null,
          },
          away: {
            teamId: "135",
            name: "San Diego Padres",
            abbreviation: "SD",
            score: null,
            logoUrl: null,
          },
        }),
      ],
      [PADRES],
      new Set(),
      LA,
    );
    expect(event.title).toBe("Padres at Los Angeles Dodgers");
  });

  it("shows a game whose time is not set yet as all-day, time TBA", () => {
    const [event] = sportsGameEvents(
      [game({ timeTbd: true })],
      [PADRES],
      new Set(),
      LA,
    );
    expect(event.isAllDay).toBe(true);
    expect(event.title).toBe("Padres vs Los Angeles Dodgers (time TBA)");
  });

  it("adds the score while live and after the game, unless it is hidden and not revealed", () => {
    const live = game({
      state: "LIVE",
      detail: "Top 5th",
      home: {
        teamId: "135",
        name: "San Diego Padres",
        abbreviation: "SD",
        score: 2,
        logoUrl: null,
      },
      away: {
        teamId: "119",
        name: "Los Angeles Dodgers",
        abbreviation: "LAD",
        score: 1,
        logoUrl: null,
      },
    });
    expect(sportsGameEvents([live], [PADRES], new Set(), LA)[0].title).toBe(
      "Padres vs Los Angeles Dodgers · LAD 1, SD 2 · Top 5th",
    );

    const hidden = { ...live, hideScores: true };
    expect(sportsGameEvents([hidden], [PADRES], new Set(), LA)[0].title).toBe(
      "Padres vs Los Angeles Dodgers · Live",
    );
    expect(
      sportsGameEvents([hidden], [PADRES], new Set(["g1"]), LA)[0].title,
    ).toBe("Padres vs Los Angeles Dodgers · LAD 1, SD 2 · Top 5th");

    const final = { ...live, state: "FINAL" as const, detail: "Final" };
    expect(sportsGameEvents([final], [PADRES], new Set(), LA)[0].title).toBe(
      "Padres vs Los Angeles Dodgers · LAD 1, SD 2 · Final",
    );
  });

  it("says when a game is postponed", () => {
    const [event] = sportsGameEvents(
      [game({ state: "POSTPONED", detail: "Postponed: Rain" })],
      [PADRES],
      new Set(),
      LA,
    );
    expect(event.title).toBe("Padres vs Los Angeles Dodgers · Postponed: Rain");
  });

  it("keeps a game nobody is a fan of out of every lane but on the calendar", () => {
    const [event] = sportsGameEvents(
      [game({ memberIds: [] })],
      [PADRES],
      new Set(),
      LA,
    );
    expect(event.memberId).toBe("");
    expect(event.memberIds).toEqual([]);
  });
});

describe("calendar members", () => {
  const one = { memberId: "mom" };
  const fans = { memberId: "dad", memberIds: ["dad", "leo"] };
  const nobody = { memberId: "", memberIds: [] };

  it("lists every member an entry belongs to", () => {
    expect(eventMemberIds(one)).toEqual(["mom"]);
    expect(eventMemberIds(fans)).toEqual(["dad", "leo"]);
    expect(eventMemberIds(nobody)).toEqual([]);
  });

  it("puts an entry in each of its members' lanes", () => {
    expect(belongsToMember(fans, "leo")).toBe(true);
    expect(belongsToMember(fans, "mom")).toBe(false);
    expect(belongsToMember(one, "mom")).toBe(true);
  });

  it("passes the member filter when any of its members is shown, or it has none", () => {
    expect(matchesMemberFilter(fans, ["leo"])).toBe(true);
    expect(matchesMemberFilter(fans, ["mom"])).toBe(false);
    expect(matchesMemberFilter(one, ["mom"])).toBe(true);
    expect(matchesMemberFilter(nobody, ["mom"])).toBe(true);
  });
});
