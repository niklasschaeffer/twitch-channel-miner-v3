import { describe, expect, it } from "vitest";
import { markDropClaimed, parseDropCampaigns, selectClaimableDrops } from "../server/drops.js";

type DropOverrides = {
  id?: string;
  name?: string;
  requiredMinutesWatched?: unknown;
  requiredSubs?: number;
  self?: Record<string, unknown>;
};

function drop(overrides: DropOverrides = {}) {
  return {
    id: overrides.id ?? "drop-1",
    name: overrides.name ?? "Scavenger Helmet",
    requiredMinutesWatched:
      "requiredMinutesWatched" in overrides ? overrides.requiredMinutesWatched : 30,
    requiredSubs: overrides.requiredSubs ?? 0,
    self: {
      hasPreconditionsMet: true,
      currentMinutesWatched: 12,
      currentSubs: 0,
      isClaimed: false,
      dropInstanceID: `user#campaign-1#${overrides.id ?? "drop-1"}`,
      ...overrides.self,
    },
  };
}

function campaign(drops: unknown[], id = "campaign-1") {
  return {
    id,
    name: "PoE1 ExileCon 2/4",
    status: "ACTIVE",
    endAt: "2026-09-11T20:59:59.999Z",
    game: {
      id: "29307",
      name: "Path of Exile",
      boxArtURL: "https://static-cdn.jtvnw.net/ttv-boxart/29307_IGDB-285x380.jpg",
    },
    timeBasedDrops: drops,
  };
}

describe("parseDropCampaigns", () => {
  it("maps the Inventory response into campaign progress", () => {
    expect(parseDropCampaigns([campaign([drop()])])).toEqual([
      {
        campaignId: "campaign-1",
        name: "PoE1 ExileCon 2/4",
        game: "Path of Exile",
        gameBoxArtUrl: "https://static-cdn.jtvnw.net/ttv-boxart/29307_IGDB-285x380.jpg",
        endsAt: "2026-09-11T20:59:59.999Z",
        drops: [
          {
            dropId: "drop-1",
            name: "Scavenger Helmet",
            requiredMinutes: 30,
            currentMinutes: 12,
            isClaimed: false,
          },
        ],
      },
    ]);
  });

  it("keeps claimed drops of a campaign that still has unclaimed ones", () => {
    const parsed = parseDropCampaigns([
      campaign([drop({ id: "a", self: { isClaimed: true } }), drop({ id: "b" })]),
    ]);
    expect(parsed[0].drops.map((d) => [d.dropId, d.isClaimed])).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  it("drops campaigns whose drops are all claimed", () => {
    expect(parseDropCampaigns([campaign([drop({ self: { isClaimed: true } })])])).toEqual([]);
  });

  it("skips drops without a numeric watch requirement", () => {
    expect(parseDropCampaigns([campaign([drop({ requiredMinutesWatched: null })])])).toEqual([]);
  });

  it("returns nothing for malformed input", () => {
    expect(parseDropCampaigns(undefined)).toEqual([]);
    expect(parseDropCampaigns({})).toEqual([]);
    expect(parseDropCampaigns([null, 42, { name: "no id" }])).toEqual([]);
  });

  it("falls back to null for missing optional campaign fields", () => {
    const bare = { id: "c", name: "Bare", timeBasedDrops: [drop()] };
    const [parsed] = parseDropCampaigns([bare]);
    expect(parsed.game).toBe("");
    expect(parsed.gameBoxArtUrl).toBeNull();
    expect(parsed.endsAt).toBeNull();
  });
});

describe("selectClaimableDrops", () => {
  it("selects unclaimed drops whose watch requirement is met", () => {
    const ready = drop({ self: { currentMinutesWatched: 30 } });
    expect(selectClaimableDrops([campaign([ready])])).toEqual([
      {
        dropId: "drop-1",
        instanceId: "user#campaign-1#drop-1",
        dropName: "Scavenger Helmet",
        campaignName: "PoE1 ExileCon 2/4",
        game: "Path of Exile",
      },
    ]);
  });

  it("ignores drops that are in progress, claimed, locked, or missing an instance id", () => {
    const drops = [
      drop({ id: "progress", self: { currentMinutesWatched: 29 } }),
      drop({ id: "claimed", self: { currentMinutesWatched: 30, isClaimed: true } }),
      drop({ id: "locked", self: { currentMinutesWatched: 30, hasPreconditionsMet: false } }),
      drop({ id: "no-instance", self: { currentMinutesWatched: 30, dropInstanceID: null } }),
      drop({ id: "needs-sub", requiredSubs: 1, self: { currentMinutesWatched: 30 } }),
    ];
    expect(selectClaimableDrops([campaign(drops)])).toEqual([]);
  });

  it("returns nothing for malformed input", () => {
    expect(selectClaimableDrops(null)).toEqual([]);
    expect(selectClaimableDrops([{ timeBasedDrops: "nope" }])).toEqual([]);
  });
});

describe("markDropClaimed", () => {
  it("marks the drop claimed and keeps campaigns with remaining drops", () => {
    const campaigns = parseDropCampaigns([campaign([drop({ id: "a" }), drop({ id: "b" })])]);
    const updated = markDropClaimed(campaigns, "a");
    expect(updated[0].drops.map((d) => d.isClaimed)).toEqual([true, false]);
    expect(campaigns[0].drops[0].isClaimed).toBe(false);
  });

  it("removes a campaign once its last drop is claimed", () => {
    const campaigns = parseDropCampaigns([campaign([drop({ id: "a" })])]);
    expect(markDropClaimed(campaigns, "a")).toEqual([]);
  });
});
