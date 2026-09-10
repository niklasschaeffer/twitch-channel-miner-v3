import type { PredictionStrategy } from "../src/types.js";

export interface PredictionOutcomeStats {
  totalUsers: number | null;
  totalPoints: number | null;
}

export const SMART_RATIO_PERCENTAGE_GAP = 20;

export function selectPredictionOutcome(
  outcomes: PredictionOutcomeStats[],
  strategy: PredictionStrategy,
): number {
  if (outcomes.length === 0) {
    return 0;
  }

  const firstUsers = outcomes[0].totalUsers ?? 0;
  const firstPoints = outcomes[0].totalPoints ?? 0;
  let usersSum = firstUsers;
  let computable = outcomes.length >= 2 && firstPoints > 0;
  let minPoints = firstPoints;
  let maxPoints = firstPoints;
  let minPointsIndex = 0;
  let maxPointsIndex = 0;
  let majorityIndex = 0;
  let majorityUsers = firstUsers;
  let minUsers = firstUsers;
  let maxUsers = firstUsers;
  let hasPositiveUsers = firstUsers > 0;

  for (let index = 1; index < outcomes.length; index++) {
    const users = outcomes[index].totalUsers ?? 0;
    const points = outcomes[index].totalPoints ?? 0;
    usersSum += users;
    if (points <= 0) {
      computable = false;
    }
    if (users > 0) {
      hasPositiveUsers = true;
    }
    if (points < minPoints) {
      minPoints = points;
      minPointsIndex = index;
    }
    if (points > maxPoints) {
      maxPoints = points;
      maxPointsIndex = index;
    }
    if (users > majorityUsers) {
      majorityUsers = users;
      majorityIndex = index;
    }
    if (users < minUsers) {
      minUsers = users;
    }
    if (users > maxUsers) {
      maxUsers = users;
    }
  }

  if (computable && usersSum > 0) {
    if (strategy === "conservative") {
      return majorityIndex;
    }
    if (
      strategy === "smart_ratio" &&
      (100 * (maxUsers - minUsers)) / usersSum >= SMART_RATIO_PERCENTAGE_GAP
    ) {
      return majorityIndex;
    }
    if (strategy === "lowest_odds") {
      return maxPointsIndex;
    }
    return minPointsIndex;
  }

  if (hasPositiveUsers) {
    return majorityIndex;
  }
  return 0;
}
