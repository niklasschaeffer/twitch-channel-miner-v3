export interface StreamerPatch {
  enabled?: boolean;
  priority?: number;
  lurkEnabled?: boolean;
  lurkMessage?: string;
}

export type StreamerPatchResult = { ok: true; patch: StreamerPatch } | { ok: false; error: string };

const MIN_PRIORITY = 1;
const MAX_PRIORITY = 1_000_000;
const MAX_LURK_MESSAGE_LENGTH = 500;

export function sanitizeStreamerPatch(body: unknown): StreamerPatchResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be an object" };
  }
  const input = body as Record<string, unknown>;
  const patch: StreamerPatch = {};

  if ("enabled" in input) {
    if (typeof input.enabled !== "boolean") {
      return { ok: false, error: "enabled must be a boolean" };
    }
    patch.enabled = input.enabled;
  }

  if ("priority" in input) {
    const priority = input.priority;
    if (
      typeof priority !== "number" ||
      !Number.isFinite(priority) ||
      !Number.isInteger(priority) ||
      priority < MIN_PRIORITY ||
      priority > MAX_PRIORITY
    ) {
      return {
        ok: false,
        error: `priority must be an integer between ${MIN_PRIORITY} and ${MAX_PRIORITY}`,
      };
    }
    patch.priority = priority;
  }

  if ("lurkEnabled" in input) {
    if (typeof input.lurkEnabled !== "boolean") {
      return { ok: false, error: "lurkEnabled must be a boolean" };
    }
    patch.lurkEnabled = input.lurkEnabled;
  }

  if ("lurkMessage" in input) {
    if (typeof input.lurkMessage !== "string") {
      return { ok: false, error: "lurkMessage must be a string" };
    }
    const trimmed = input.lurkMessage.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LURK_MESSAGE_LENGTH) {
      return {
        ok: false,
        error: `lurkMessage must be 1-${MAX_LURK_MESSAGE_LENGTH} characters`,
      };
    }
    patch.lurkMessage = trimmed;
  }

  return { ok: true, patch };
}
