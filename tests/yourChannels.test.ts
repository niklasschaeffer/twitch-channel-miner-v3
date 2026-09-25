import { describe, expect, it } from "vitest";
import { YourChannelSuggestion } from "../src/types.js";
import { composeYourChannels, parseChannelFollowsLogins } from "../server/yourChannels.js";

const make = (
  username: string,
  reason: YourChannelSuggestion["reason"],
): YourChannelSuggestion => ({
  username,
  displayName: username,
  reason,
});

describe("composeYourChannels", () => {
  it("takes 12 of 30 with primary shares 6 sub, 4 follow, 2 game", () => {
    const subs = Array.from({ length: 10 }, (_, i) => make(`sub${i}`, "sub"));
    const follows = Array.from({ length: 10 }, (_, i) => make(`follow${i}`, "follow"));
    const gameStreams = Array.from({ length: 10 }, (_, i) => make(`game${i}`, "game"));

    const result = composeYourChannels({ existing: [], subs, follows, gameStreams });

    expect(result).toHaveLength(12);
    expect(result.slice(0, 6).every((entry) => entry.reason === "sub")).toBe(true);
    expect(result.slice(6, 10).every((entry) => entry.reason === "follow")).toBe(true);
    expect(result.slice(10).every((entry) => entry.reason === "game")).toBe(true);
    expect(result[0]).toEqual(subs[0]);
    expect(result[5]).toEqual(subs[5]);
    expect(result[6]).toEqual(follows[0]);
    expect(result[9]).toEqual(follows[3]);
    expect(result[10]).toEqual(gameStreams[0]);
    expect(result[11]).toEqual(gameStreams[1]);
  });

  it("fills leftovers from the highest priority bucket when primary shares leave gaps", () => {
    const result = composeYourChannels({
      existing: [],
      subs: [make("solo", "sub")],
      follows: [],
      gameStreams: Array.from({ length: 11 }, (_, i) => make(`game${i}`, "game")),
    });

    expect(result).toHaveLength(12);
    expect(result[0]).toEqual(make("solo", "sub"));
    expect(result.slice(1).every((entry) => entry.reason === "game")).toBe(true);
    expect(result[1]).toEqual(make("game0", "game"));
    expect(result[11]).toEqual(make("game10", "game"));
  });

  it("prefers the sub entry when the same username appears in subs and follows", () => {
    const result = composeYourChannels({
      existing: [],
      subs: [make("dupe", "sub")],
      follows: [make("DUPE", "follow")],
      gameStreams: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe("sub");
  });

  it("excludes existing watchlist entries case-insensitively", () => {
    const result = composeYourChannels({
      existing: ["Watched"],
      subs: [make("watched", "sub"), make("fresh", "sub")],
      follows: [],
      gameStreams: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("fresh");
  });

  it("never mutates its inputs", () => {
    const subs = [make("a", "sub"), make("b", "sub")];
    const follows = [make("b", "follow"), make("c", "follow")];
    const gameStreams = [make("c", "game")];
    const subsSnapshot = [...subs];
    const followsSnapshot = [...follows];
    const gameStreamsSnapshot = [...gameStreams];

    composeYourChannels({ existing: [], subs, follows, gameStreams });

    expect(subs).toEqual(subsSnapshot);
    expect(follows).toEqual(followsSnapshot);
    expect(gameStreams).toEqual(gameStreamsSnapshot);
  });
});

describe("parseChannelFollowsLogins", () => {
  it("extracts logins from a ChannelFollows persisted-op response", () => {
    const body = {
      data: {
        user: {
          id: "37441513",
          follows: {
            edges: [
              {
                cursor: "a",
                node: { id: "1", login: "streamerhouse", displayName: "StreamerHouse" },
              },
              { cursor: "b", node: { id: "2", login: "warframe", displayName: "Warframe" } },
              { cursor: "c", node: null },
              { cursor: "d", node: { id: "3", login: "" } },
            ],
            pageInfo: { hasNextPage: false },
          },
        },
      },
    };

    expect(parseChannelFollowsLogins(body)).toEqual(["streamerhouse", "warframe"]);
  });

  it("returns an empty list for an account that follows nobody", () => {
    expect(parseChannelFollowsLogins({ data: { user: { follows: { edges: [] } } } })).toEqual([]);
  });

  it("returns null when Twitch reports an error or omits the follows connection", () => {
    expect(
      parseChannelFollowsLogins({
        errors: [{ message: "service error", path: ["user", "follows"] }],
        data: { user: { follows: null } },
      }),
    ).toBeNull();
    expect(
      parseChannelFollowsLogins({ errors: [{ message: "PersistedQueryNotFound" }] }),
    ).toBeNull();
    expect(parseChannelFollowsLogins([])).toBeNull();
    expect(parseChannelFollowsLogins(null)).toBeNull();
  });
});
