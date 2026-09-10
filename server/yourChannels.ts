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
