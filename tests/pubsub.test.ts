import { describe, expect, it } from "vitest";
import {
  buildDesiredPubsubTopics,
  chunkTopics,
  describePubsubKeys,
  diffPubsubTopics,
  MAX_PUBSUB_TOPICS,
  parsePointsMessage,
  parsePredictionEvent,
  parsePredictionUserMessage,
  pubsubReconnectDelayMs,
} from "../server/pubsub.js";

const pointsEarnedFields = {
  timestamp: "2026-09-11T19:00:00Z",
  channel_id: "12345",
  point_gain: {
    user_id: "999",
    channel_id: "12345",
    total_points: 250,
    baseline_points: 250,
    reason_code: "RAID",
    multipliers: [],
  },
  balance: { user_id: "999", channel_id: "12345", balance: 8172 },
};

describe("parsePointsMessage", () => {
  it("reads balance, channel and reason from the nested data envelope", () => {
    expect(parsePointsMessage({ type: "points-earned", data: pointsEarnedFields })).toEqual({
      type: "points-earned",
      balance: 8172,
      channelId: "12345",
      reasonCode: "RAID",
      pointsGained: 250,
      claimId: null,
    });
  });

  it("reads the same fields when they sit at the top level", () => {
    const parsed = parsePointsMessage({ type: "points-earned", ...pointsEarnedFields });
    expect(parsed?.balance).toBe(8172);
    expect(parsed?.reasonCode).toBe("RAID");
  });

  it("extracts the claim id and channel of a claim-available message", () => {
    const parsed = parsePointsMessage({
      type: "claim-available",
      data: { claim: { id: "claim-1", channel_id: "12345" } },
    });
    expect(parsed?.claimId).toBe("claim-1");
    expect(parsed?.channelId).toBe("12345");
    expect(parsed?.balance).toBeNull();
  });

  it("rejects messages without a type", () => {
    expect(parsePointsMessage({ data: pointsEarnedFields })).toBeNull();
  });
});

describe("parsePredictionEvent", () => {
  const event = {
    id: "event-1",
    status: "ACTIVE",
    created_at: "2026-09-11T19:00:00Z",
    prediction_window_seconds: 120,
    outcomes: [
      { id: "o1", title: "Yes", total_users: 0, total_points: 0 },
      { id: "o2", title: "No", total_users: 4, total_points: 900 },
      { title: "missing id" },
    ],
  };

  it("parses a nested event and nulls out empty pools", () => {
    expect(parsePredictionEvent({ type: "event-updated", data: { event } })).toEqual({
      id: "event-1",
      status: "ACTIVE",
      createdAt: "2026-09-11T19:00:00Z",
      predictionWindowSeconds: 120,
      outcomes: [
        { id: "o1", title: "Yes", totalUsers: null, totalPoints: null },
        { id: "o2", title: "No", totalUsers: 4, totalPoints: 900 },
      ],
    });
  });

  it("nulls out createdAt and predictionWindowSeconds when absent", () => {
    const parsed = parsePredictionEvent({
      type: "event-created",
      data: { event: { id: "event-2", status: "ACTIVE", outcomes: [] } },
    });
    expect(parsed?.createdAt).toBeNull();
    expect(parsed?.predictionWindowSeconds).toBeNull();
  });

  it("parses a top-level event", () => {
    expect(parsePredictionEvent({ type: "event-created", event })?.outcomes).toHaveLength(2);
  });

  it("returns null without an event id", () => {
    expect(parsePredictionEvent({ type: "event-created", data: { event: {} } })).toBeNull();
  });
});

describe("parsePredictionUserMessage", () => {
  it("parses a won prediction result", () => {
    expect(
      parsePredictionUserMessage({
        type: "prediction-result",
        data: {
          prediction: {
            event_id: "event-1",
            points: 100,
            result: { type: "WIN", points_won: 240 },
          },
        },
      }),
    ).toEqual({ type: "prediction-result", eventId: "event-1", result: "WIN", pointsWon: 240 });
  });

  it("treats a null payout as zero", () => {
    const parsed = parsePredictionUserMessage({
      type: "prediction-result",
      data: { prediction: { event_id: "e", result: { type: "LOSE", points_won: null } } },
    });
    expect(parsed).toEqual({
      type: "prediction-result",
      eventId: "e",
      result: "LOSE",
      pointsWon: 0,
    });
  });

  it("parses a prediction-made confirmation", () => {
    expect(
      parsePredictionUserMessage({
        type: "prediction-made",
        data: { prediction: { event_id: "e" } },
      }),
    ).toEqual({ type: "prediction-made", eventId: "e" });
  });

  it("ignores unknown result types", () => {
    expect(
      parsePredictionUserMessage({
        type: "prediction-result",
        data: { prediction: { event_id: "e", result: { type: "MAYBE" } } },
      }),
    ).toBeNull();
  });
});

describe("describePubsubKeys", () => {
  it("lists top-level and envelope keys", () => {
    expect(describePubsubKeys({ type: "x", data: { a: 1, b: 2 } })).toBe("type,data / data: a,b");
    expect(describePubsubKeys({ type: "x", raid: {} })).toBe("type,raid");
  });
});

describe("buildDesiredPubsubTopics", () => {
  it("combines user and channel topics without truncation under the cap", () => {
    const result = buildDesiredPubsubTopics(["community-points-user-v1.1"], ["raid.2", "raid.3"]);
    expect(result).toEqual({
      topics: ["community-points-user-v1.1", "raid.2", "raid.3"],
      truncated: false,
    });
  });

  it("truncates at the 50-topic connection cap and reports truncation", () => {
    const channelTopics = Array.from({ length: 60 }, (_, i) => `raid.${i}`);
    const result = buildDesiredPubsubTopics(["community-points-user-v1.1"], channelTopics);
    expect(result.topics).toHaveLength(MAX_PUBSUB_TOPICS);
    expect(result.truncated).toBe(true);
    expect(result.topics[0]).toBe("community-points-user-v1.1");
  });
});

describe("diffPubsubTopics", () => {
  it("lists topics to listen and unlisten against the current set", () => {
    const listened = new Set(["a", "b", "c"]);
    const result = diffPubsubTopics(listened, ["b", "c", "d"]);
    expect(result.listen).toEqual(["d"]);
    expect(result.unlisten).toEqual(["a"]);
  });

  it("requests nothing when the listened set already matches", () => {
    const listened = new Set(["a", "b"]);
    expect(diffPubsubTopics(listened, ["a", "b"])).toEqual({ listen: [], unlisten: [] });
  });

  it("unlistens everything when nothing is desired", () => {
    const listened = new Set(["a", "b"]);
    expect(diffPubsubTopics(listened, [])).toEqual({ listen: [], unlisten: ["a", "b"] });
  });
});

describe("chunkTopics", () => {
  it("returns an empty array for no topics", () => {
    expect(chunkTopics([])).toEqual([]);
  });

  it("keeps a single chunk under the default size", () => {
    expect(chunkTopics(["a", "b", "c"])).toEqual([["a", "b", "c"]]);
  });

  it("splits into fixed-size chunks respecting a custom size", () => {
    expect(chunkTopics(["a", "b", "c", "d", "e"], 2)).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });
});

describe("pubsubReconnectDelayMs", () => {
  it("starts at the base delay on the first attempt", () => {
    expect(pubsubReconnectDelayMs(0)).toBe(10_000);
  });

  it("doubles per attempt", () => {
    expect(pubsubReconnectDelayMs(1)).toBe(20_000);
    expect(pubsubReconnectDelayMs(2)).toBe(40_000);
    expect(pubsubReconnectDelayMs(3)).toBe(80_000);
  });

  it("caps at the maximum delay", () => {
    expect(pubsubReconnectDelayMs(10)).toBe(300_000);
  });

  it("treats negative or non-finite attempts as the first attempt", () => {
    expect(pubsubReconnectDelayMs(-3)).toBe(10_000);
    expect(pubsubReconnectDelayMs(Number.NaN)).toBe(10_000);
  });

  it("honors custom base and max delays", () => {
    expect(pubsubReconnectDelayMs(2, 1000, 5000)).toBe(4000);
    expect(pubsubReconnectDelayMs(5, 1000, 5000)).toBe(5000);
  });
});
