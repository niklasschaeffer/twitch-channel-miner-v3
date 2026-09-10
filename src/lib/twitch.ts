/**
 * Extracts and sanitizes a Twitch channel username from raw inputs
 * (handles full URLs like https://www.twitch.tv/channel, @channel, or channel).
 */
export function extractTwitchUsername(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.trim().toLowerCase();
  // Strip URL prefixes like https://www.twitch.tv/, http://, www., m.twitch.tv/
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?(m\.)?twitch\.tv\//i, "");
  // Strip leading @ or /
  cleaned = cleaned.replace(/^[@/]+/, "");
  // Strip query parameters (?param=val) and hash anchors (#...), trailing slashes
  cleaned = cleaned.split("?")[0].split("#")[0].replace(/\/+$/, "");
  // Match standard Twitch login pattern: alphanumeric and underscore up to 35 chars
  const match = cleaned.match(/^[a-z0-9_]{1,35}/i);
  return match ? match[0].toLowerCase() : cleaned;
}
