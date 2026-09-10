export function formatSubTier(tier: string): string {
  if (tier === "1000") return "T1";
  if (tier === "2000") return "T2";
  if (tier === "3000") return "T3";
  if (tier === "prime") return "Prime";
  return tier.toUpperCase();
}
