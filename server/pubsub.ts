import type { PredictionResultType } from "./prediction.js";

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function stringField(source: JsonObject | null, key: string): string | null {
  const value = source?.[key];
  return typeof value === "string" ? value : null;
}

function numberField(source: JsonObject | null, key: string): number | null {
  const value = source?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function pubsubMessageBody(payload: JsonObject): JsonObject {
  return asObject(payload.data) ?? payload;
}

export function describePubsubKeys(payload: JsonObject): string {
  const body = pubsubMessageBody(payload);
  const top = Object.keys(payload).join(",");
  return body === payload ? top : `${top} / data: ${Object.keys(body).join(",")}`;
}

export interface PointsMessage {
  type: string;
  balance: number | null;
  channelId: string | null;
  reasonCode: string | null;
  pointsGained: number | null;
  claimId: string | null;
}

export function parsePointsMessage(payload: JsonObject): PointsMessage | null {
  const type = stringField(payload, "type");
  if (!type) return null;
  const body = pubsubMessageBody(payload);
  const balance = asObject(body.balance);
  const pointGain = asObject(body.point_gain);
  const claim = asObject(body.claim);
  return {
    type,
    balance: numberField(balance, "balance"),
    channelId:
      stringField(balance, "channel_id") ??
      stringField(pointGain, "channel_id") ??
      stringField(claim, "channel_id") ??
      stringField(body, "channel_id"),
    reasonCode: stringField(pointGain, "reason_code") ?? stringField(body, "reason_code"),
    pointsGained: numberField(pointGain, "total_points"),
    claimId: stringField(claim, "id"),
  };
}

export interface PredictionOutcomeMessage {
  id: string;
  title: string | null;
  totalUsers: number | null;
  totalPoints: number | null;
}

export interface PredictionEventMessage {
  id: string;
  status: string;
  outcomes: PredictionOutcomeMessage[];
  createdAt: string | null;
  predictionWindowSeconds: number | null;
}

export function parsePredictionEvent(payload: JsonObject): PredictionEventMessage | null {
  const event = asObject(pubsubMessageBody(payload).event);
  const id = stringField(event, "id");
  if (!event || !id) return null;
  const rawOutcomes = Array.isArray(event.outcomes) ? event.outcomes : [];
  const outcomes: PredictionOutcomeMessage[] = [];
  for (const raw of rawOutcomes) {
    const outcome = asObject(raw);
    const outcomeId = stringField(outcome, "id");
    if (!outcomeId) continue;
    const users = numberField(outcome, "total_users");
    const points = numberField(outcome, "total_points");
    outcomes.push({
      id: outcomeId,
      title: stringField(outcome, "title"),
      totalUsers: users !== null && users > 0 ? users : null,
      totalPoints: points !== null && points > 0 ? points : null,
    });
  }
  return {
    id,
    status: stringField(event, "status") ?? "",
    outcomes,
    createdAt: stringField(event, "created_at"),
    predictionWindowSeconds: numberField(event, "prediction_window_seconds"),
  };
}

export type PredictionUserMessage =
  | { type: "prediction-made"; eventId: string }
  | {
      type: "prediction-result";
      eventId: string;
      result: PredictionResultType;
      pointsWon: number;
    };

const RESULT_TYPES: readonly PredictionResultType[] = ["WIN", "LOSE", "REFUND"];

export const MAX_PUBSUB_TOPICS = 50;

export function buildDesiredPubsubTopics(
  userTopics: readonly string[],
  channelTopics: readonly string[],
): { topics: string[]; truncated: boolean } {
  const combined = [...userTopics, ...channelTopics];
  if (combined.length <= MAX_PUBSUB_TOPICS) {
    return { topics: combined, truncated: false };
  }
  return { topics: combined.slice(0, MAX_PUBSUB_TOPICS), truncated: true };
}

export function diffPubsubTopics(
  listened: ReadonlySet<string>,
  desired: readonly string[],
): { listen: string[]; unlisten: string[] } {
  const desiredSet = new Set(desired);
  const listen = desired.filter((topic) => !listened.has(topic));
  const unlisten = [...listened].filter((topic) => !desiredSet.has(topic));
  return { listen, unlisten };
}

export function chunkTopics(
  topics: readonly string[],
  size: number = MAX_PUBSUB_TOPICS,
): string[][] {
  if (topics.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < topics.length; i += size) {
    chunks.push(topics.slice(i, i + size));
  }
  return chunks;
}

export function pubsubReconnectDelayMs(
  attempt: number,
  baseMs: number = 10_000,
  maxMs: number = 300_000,
): number {
  const safeAttempt = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  const exponential = baseMs * Math.pow(2, safeAttempt);
  return Math.min(exponential, maxMs);
}

export function parsePredictionUserMessage(payload: JsonObject): PredictionUserMessage | null {
  const type = stringField(payload, "type");
  const prediction = asObject(pubsubMessageBody(payload).prediction);
  const eventId = stringField(prediction, "event_id");
  if (!eventId) return null;
  if (type === "prediction-made") return { type, eventId };
  if (type !== "prediction-result") return null;
  const result = asObject(prediction?.result);
  const resultType = RESULT_TYPES.find((r) => r === stringField(result, "type"));
  if (!resultType) return null;
  return {
    type,
    eventId,
    result: resultType,
    pointsWon: numberField(result, "points_won") ?? 0,
  };
}
