import type { MinerStatus } from "../types";

export function sessionPointsPerHour(status: MinerStatus): number | null {
  if (status.uptimeSeconds <= 60) return null;
  return Math.round((status.pointsThisSession / status.uptimeSeconds) * 3600);
}
