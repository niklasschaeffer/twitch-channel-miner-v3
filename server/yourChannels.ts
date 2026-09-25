import { YourChannelSuggestion } from "../src/types.js";

export interface ComposeYourChannelsInput {
  existing: string[];
  subs: YourChannelSuggestion[];
  follows: YourChannelSuggestion[];
  gameStreams: YourChannelSuggestion[];
}

const MAX_TOTAL = 12;

const PRIMARY_SHARES: ReadonlyArray<readonly ["subs" | "follows" | "gameStreams", number]> = [
  ["subs", 6],
  ["follows", 4],
  ["gameStreams", 4],
];

const BUCKET_ORDER: ReadonlyArray<"subs" | "follows" | "gameStreams"> = [
  "subs",
  "follows",
  "gameStreams",
];

const lower = (value: string): string => value.toLowerCase();

export function composeYourChannels(input: ComposeYourChannelsInput): YourChannelSuggestion[] {
  const existing = new Set(input.existing.map(lower));
  const seen = new Set<string>();

  const buckets: Record<"subs" | "follows" | "gameStreams", YourChannelSuggestion[]> = {
    subs: [],
    follows: [],
    gameStreams: [],
  };

  for (const bucket of BUCKET_ORDER) {
    for (const entry of input[bucket]) {
      const key = lower(entry.username);
      if (existing.has(key) || seen.has(key)) continue;
      seen.add(key);
      buckets[bucket].push(entry);
    }
  }

  const result: YourChannelSuggestion[] = [];
  const leftovers: YourChannelSuggestion[] = [];

  for (const [bucket, share] of PRIMARY_SHARES) {
    const remaining = MAX_TOTAL - result.length;
    result.push(...buckets[bucket].slice(0, Math.min(share, remaining)));
    leftovers.push(...buckets[bucket].slice(share));
  }

  for (const entry of leftovers) {
    if (result.length >= MAX_TOTAL) break;
    result.push(entry);
  }

  return result;
}

export function parseChannelFollowsLogins(body: unknown): string[] | null {
  if (typeof body !== "object" || body === null || Array.isArray(body) || "errors" in body)
    return null;
  const data: unknown = "data" in body ? body.data : undefined;
  const user: unknown =
    typeof data === "object" && data !== null && "user" in data ? data.user : undefined;
  const follows: unknown =
    typeof user === "object" && user !== null && "follows" in user ? user.follows : undefined;
  if (
    typeof follows !== "object" ||
    follows === null ||
    !("edges" in follows) ||
    !Array.isArray(follows.edges)
  )
    return null;
  const logins: string[] = [];
  for (const edge of follows.edges) {
    const node: unknown =
      typeof edge === "object" && edge !== null && "node" in edge ? edge.node : undefined;
    const login: unknown =
      typeof node === "object" && node !== null && "login" in node ? node.login : undefined;
    if (typeof login === "string" && login.length > 0) logins.push(login);
  }
  return logins;
}
