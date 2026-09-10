export const CHEST_WATCH_MINUTES_REQUIRED = 15;

export function computeChestProgress(watchedMinutes: number): {
  nextChestEstimateSeconds: number;
  chestAvailable: boolean;
} {
  const watched = Math.min(watchedMinutes, CHEST_WATCH_MINUTES_REQUIRED);
  return {
    nextChestEstimateSeconds: Math.max(0, (CHEST_WATCH_MINUTES_REQUIRED - watched) * 60),
    chestAvailable: watched >= CHEST_WATCH_MINUTES_REQUIRED,
  };
}
