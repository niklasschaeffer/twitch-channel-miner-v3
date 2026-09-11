import type { DropCampaignProgress, DropProgress } from "../src/types.js";

export interface ClaimableDrop {
  dropId: string;
  instanceId: string;
  dropName: string;
  campaignName: string;
  game: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function campaignDrops(campaign: Record<string, unknown>): unknown[] {
  return Array.isArray(campaign.timeBasedDrops) ? campaign.timeBasedDrops : [];
}

function toDropProgress(raw: unknown): DropProgress | null {
  const drop = asRecord(raw);
  const dropId = asString(drop.id);
  const requiredMinutes = asNumber(drop.requiredMinutesWatched);
  if (dropId === null || requiredMinutes === null) return null;
  const self = asRecord(drop.self);
  return {
    dropId,
    name: asString(drop.name) ?? "",
    requiredMinutes,
    currentMinutes: asNumber(self.currentMinutesWatched) ?? 0,
    isClaimed: self.isClaimed === true,
  };
}

function hasUnclaimedDrop(campaign: DropCampaignProgress): boolean {
  return campaign.drops.some((d) => !d.isClaimed);
}

export function parseDropCampaigns(rawCampaigns: unknown): DropCampaignProgress[] {
  if (!Array.isArray(rawCampaigns)) return [];
  const campaigns: DropCampaignProgress[] = [];
  for (const raw of rawCampaigns) {
    const campaign = asRecord(raw);
    const campaignId = asString(campaign.id);
    if (campaignId === null) continue;
    const game = asRecord(campaign.game);
    const parsed: DropCampaignProgress = {
      campaignId,
      name: asString(campaign.name) ?? "",
      game: asString(game.name) ?? "",
      gameBoxArtUrl: asString(game.boxArtURL),
      endsAt: asString(campaign.endAt),
      drops: campaignDrops(campaign)
        .map(toDropProgress)
        .filter((d): d is DropProgress => d !== null),
    };
    if (hasUnclaimedDrop(parsed)) campaigns.push(parsed);
  }
  return campaigns;
}

export function selectClaimableDrops(rawCampaigns: unknown): ClaimableDrop[] {
  if (!Array.isArray(rawCampaigns)) return [];
  const claimable: ClaimableDrop[] = [];
  for (const raw of rawCampaigns) {
    const campaign = asRecord(raw);
    for (const rawDrop of campaignDrops(campaign)) {
      const drop = asRecord(rawDrop);
      const self = asRecord(drop.self);
      const dropId = asString(drop.id);
      const instanceId = asString(self.dropInstanceID);
      const requiredMinutes = asNumber(drop.requiredMinutesWatched);
      const currentMinutes = asNumber(self.currentMinutesWatched) ?? 0;
      const requiredSubs = asNumber(drop.requiredSubs) ?? 0;
      const currentSubs = asNumber(self.currentSubs) ?? 0;
      if (
        dropId === null ||
        instanceId === null ||
        requiredMinutes === null ||
        self.isClaimed === true ||
        self.hasPreconditionsMet === false ||
        currentMinutes < requiredMinutes ||
        currentSubs < requiredSubs
      )
        continue;
      claimable.push({
        dropId,
        instanceId,
        dropName: asString(drop.name) ?? "",
        campaignName: asString(campaign.name) ?? "",
        game: asString(asRecord(campaign.game).name) ?? "",
      });
    }
  }
  return claimable;
}

export function markDropClaimed(
  campaigns: DropCampaignProgress[],
  dropId: string,
): DropCampaignProgress[] {
  return campaigns
    .map((c) => ({
      ...c,
      drops: c.drops.map((d) => (d.dropId === dropId ? { ...d, isClaimed: true } : d)),
    }))
    .filter(hasUnclaimedDrop);
}
