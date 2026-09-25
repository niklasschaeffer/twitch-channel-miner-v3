import type { Request, Response } from "express";
import { mkdirSync } from "fs";
import { stat, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "./db.js";

const CACHE_TTL_SECONDS = 14400;
const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;
const UPSTREAM_TIMEOUT_MS = 12000;

const HELIX_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "ue6666qo983tsx6so1t0vnawi233wa";
const GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

const EMOTE_URL_TEMPLATE = "https://static-cdn.jtvnw.net/emoticons/v2";
const GQL_URL = "https://gql.twitch.tv/gql";
const HELIX_BADGES_CHANNEL_URL = "https://api.twitch.tv/helix/chat/badges";
const HELIX_BADGES_GLOBAL_URL = "https://api.twitch.tv/helix/chat/badges/global";

const KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
const CACHE_DIR = path.join(process.cwd(), "data", "emotes");

type AssetKind =
  | { kind: "emote"; id: string }
  | { kind: "badge"; setId: string; versionId: string }
  | { kind: "avatar"; login: string };

interface BadgeMaps {
  urls: Record<string, Record<string, string>>;
  at: number;
}

let badgeMaps: BadgeMaps | null = null;
let cacheDirEnsured = false;

function ensureCacheDir(): void {
  if (cacheDirEnsured) return;
  mkdirSync(CACHE_DIR, { recursive: true });
  cacheDirEnsured = true;
}

function cacheFilePath(asset: AssetKind): string {
  const sanitize = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, "_");
  const name =
    asset.kind === "emote"
      ? `emote-${sanitize(asset.id)}.png`
      : asset.kind === "badge"
        ? `badge-${sanitize(asset.setId)}_${sanitize(asset.versionId)}.png`
        : `avatar-${sanitize(asset.login)}.jpeg`;
  return path.join(CACHE_DIR, name);
}

async function fetchAvatarUrl(login: string): Promise<string | null> {
  try {
    const res = await fetch(GQL_URL, {
      method: "POST",
      headers: {
        "Client-Id": GQL_CLIENT_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "query($login: String!) { user(login: $login) { profileImageURL(width: 70) } }",
        variables: { login },
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(
        `Avatar GQL fetch failed for ${login}: status ${res.status} ${(await res.text()).slice(0, 200)}`,
      );
      return null;
    }
    const body: unknown = await res.json();
    if (typeof body !== "object" || body === null || !("data" in body)) return null;
    const data: unknown = body.data;
    if (typeof data !== "object" || data === null || !("user" in data)) return null;
    const user: unknown = data.user;
    if (typeof user !== "object" || user === null || !("profileImageURL" in user)) return null;
    const url: unknown = user.profileImageURL;
    return typeof url === "string" ? url : null;
  } catch (err) {
    console.warn(
      `Avatar GQL fetch error for ${login}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

async function getHelixToken(): Promise<string | null> {
  try {
    const row = await prisma.minerSetting.findFirst({
      where: { authToken: { not: "" } },
      select: { authToken: true },
    });
    return row?.authToken ?? null;
  } catch (err) {
    console.warn(`Helix token lookup failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function parseBadgeSets(body: unknown): Record<string, Record<string, string>> {
  const urls: Record<string, Record<string, string>> = {};
  if (typeof body !== "object" || body === null || !("data" in body)) return urls;
  const data: unknown = body.data;
  if (!Array.isArray(data)) return urls;
  for (const entry of data) {
    if (typeof entry !== "object" || entry === null) continue;
    if (!("set_id" in entry) || !("versions" in entry)) continue;
    const setId: unknown = entry.set_id;
    const versions: unknown = entry.versions;
    if (typeof setId !== "string" || !Array.isArray(versions)) continue;
    const versionUrls: Record<string, string> = {};
    for (const version of versions) {
      if (typeof version !== "object" || version === null) continue;
      if (!("id" in version) || !("image_url_1x" in version)) continue;
      const id: unknown = version.id;
      const url: unknown = version.image_url_1x;
      if (typeof id === "string" && typeof url === "string") versionUrls[id] = url;
    }
    urls[setId] = versionUrls;
  }
  return urls;
}

async function loadBadgeMaps(): Promise<BadgeMaps> {
  if (badgeMaps && Date.now() - badgeMaps.at < CACHE_TTL_MS) return badgeMaps;
  const token = await getHelixToken();
  if (!token) return { urls: {}, at: 0 };
  try {
    const res = await fetch(HELIX_BADGES_GLOBAL_URL, {
      headers: {
        "Client-Id": HELIX_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(
        `Helix badge map fetch failed: status ${res.status} ${(await res.text()).slice(0, 200)}`,
      );
      return { urls: {}, at: 0 };
    }
    badgeMaps = { urls: parseBadgeSets(await res.json()), at: Date.now() };
    return badgeMaps;
  } catch (err) {
    console.warn(
      `Helix badge map fetch error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return { urls: {}, at: 0 };
  }
}

async function resolveUpstreamUrl(asset: AssetKind): Promise<string | null> {
  if (asset.kind === "emote") {
    return `${EMOTE_URL_TEMPLATE}/${asset.id}/default/dark/1.0`;
  }
  if (asset.kind === "avatar") {
    return fetchAvatarUrl(asset.login);
  }
  const maps = await loadBadgeMaps();
  return maps.urls[asset.setId]?.[asset.versionId] ?? null;
}

async function serveFromCache(
  res: Response,
  filePath: string,
  requireFresh: boolean,
): Promise<boolean> {
  try {
    const info = await stat(filePath);
    if (requireFresh && Date.now() - info.mtimeMs >= CACHE_TTL_MS) return false;
  } catch {
    return false;
  }
  res.setHeader("Cache-Control", `public, max-age=${CACHE_TTL_SECONDS}`);
  res.sendFile(filePath);
  return true;
}

async function fetchAndCache(res: Response, asset: AssetKind, filePath: string): Promise<void> {
  const url = await resolveUpstreamUrl(asset);
  if (url === null) {
    const served = await serveFromCache(res, filePath, false);
    if (!served) res.status(502).json({ error: "upstream" });
    return;
  }
  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    if (!upstream.ok) {
      console.warn(
        `Emote asset fetch failed for ${url}: status ${upstream.status} ${(await upstream.text()).slice(0, 200)}`,
      );
    } else {
      const contentType = upstream.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/") && !contentType.startsWith("binary/octet-stream")) {
        console.warn(
          `Emote asset fetch for ${url} returned non-image content-type "${contentType}"`,
        );
      } else {
        const buffer = Buffer.from(await upstream.arrayBuffer());
        ensureCacheDir();
        await writeFile(filePath, buffer);
        res.setHeader("Cache-Control", `public, max-age=${CACHE_TTL_SECONDS}`);
        res.type(filePath.endsWith(".png") ? "image/png" : contentType);
        res.send(buffer);
        return;
      }
    }
  } catch (err) {
    console.warn(
      `Emote asset fetch error for ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const served = await serveFromCache(res, filePath, false);
  if (!served) res.status(502).json({ error: "upstream" });
}

function parseAssetKind(req: Request): AssetKind | null {
  if (req.path.startsWith("/api/emotes/badge/")) {
    const raw = req.params.key;
    if (typeof raw !== "string" || raw.length === 0) return null;
    let decoded: string;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      return null;
    }
    const slashIndex = decoded.indexOf("/");
    if (slashIndex <= 0 || slashIndex === decoded.length - 1) return null;
    const setId = decoded.slice(0, slashIndex);
    const versionId = decoded.slice(slashIndex + 1);
    if (!KEY_PATTERN.test(setId) || !KEY_PATTERN.test(versionId)) return null;
    return { kind: "badge", setId, versionId };
  }
  if (req.path.startsWith("/api/emotes/avatar/")) {
    const login = String(req.params.login ?? "").toLowerCase();
    if (typeof login !== "string" || !KEY_PATTERN.test(login)) return null;
    return { kind: "avatar", login };
  }
  const id = req.params.id;
  if (typeof id !== "string" || !KEY_PATTERN.test(id)) return null;
  return { kind: "emote", id };
}

export async function resolveEmoteAsset(req: Request, res: Response): Promise<void> {
  const asset = parseAssetKind(req);
  if (asset === null) {
    res.status(400).json({ error: "invalid key" });
    return;
  }
  const filePath = cacheFilePath(asset);
  if (await serveFromCache(res, filePath, true)) return;
  await fetchAndCache(res, asset, filePath);
}

export async function badgeMapHandler(_req: Request, res: Response): Promise<void> {
  const maps = await loadBadgeMaps();
  const sets: Record<string, string[]> = {};
  for (const [setId, versions] of Object.entries(maps.urls)) {
    sets[setId] = Object.keys(versions).sort();
  }
  res.json({ sets });
}
