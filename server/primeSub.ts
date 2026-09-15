export type PrimeSubSkipReason =
  | "not_armed"
  | "no_prime"
  | "already_subscribed"
  | "already_spent_this_month"
  | "channel_not_eligible";

export interface PrimeSubEligibility {
  armed: boolean;
  hasPrime: boolean;
  canPrimeSubscribe: boolean;
  subscriptionTier: string | null;
  lastPrimeSubMonth: string | null;
  currentMonth: string;
}

export type PrimeSubDecision = { redeem: true } | { redeem: false; reason: PrimeSubSkipReason };

export interface SpendSubscriptionCreditRequest {
  query: string;
  variables: { input: { broadcasterID: string; userID: string } };
}

export type PrimeSubOutcome = { ok: true; tier: string | null } | { ok: false; reason: string };

const SPEND_SUBSCRIPTION_CREDIT_QUERY =
  "mutation($input: SpendSubscriptionCreditInput!) { spendSubscriptionCredit(input: $input) { userID error { code } subscriptionBenefit { tier purchasedWithPrime } } }";

export function utcMonthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

export function latestPrimeSubMonth(
  streamers: { lastPrimeSubMonth?: string | null }[],
): string | null {
  let latest: string | null = null;
  for (const streamer of streamers) {
    const month = streamer.lastPrimeSubMonth ?? null;
    if (month !== null && (latest === null || month > latest)) latest = month;
  }
  return latest;
}

export function decidePrimeSubRedemption(eligibility: PrimeSubEligibility): PrimeSubDecision {
  if (!eligibility.armed) return { redeem: false, reason: "not_armed" };
  if (!eligibility.hasPrime) return { redeem: false, reason: "no_prime" };
  if (eligibility.subscriptionTier !== null && eligibility.subscriptionTier.length > 0) {
    return { redeem: false, reason: "already_subscribed" };
  }
  if (eligibility.lastPrimeSubMonth === eligibility.currentMonth) {
    return { redeem: false, reason: "already_spent_this_month" };
  }
  if (!eligibility.canPrimeSubscribe) return { redeem: false, reason: "channel_not_eligible" };
  return { redeem: true };
}

export function buildSpendSubscriptionCreditRequest(
  broadcasterId: string,
  userId: string,
): SpendSubscriptionCreditRequest {
  return {
    query: SPEND_SUBSCRIPTION_CREDIT_QUERY,
    variables: { input: { broadcasterID: broadcasterId, userID: userId } },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export function readSpendSubscriptionCreditResponse(raw: unknown): PrimeSubOutcome {
  const response = asRecord(raw);
  if (response === null) return { ok: false, reason: "unexpected_response" };
  if (Array.isArray(response.errors) && response.errors.length > 0) {
    return { ok: false, reason: "gql_error" };
  }
  const data = asRecord(response.data);
  const payload = data === null ? null : asRecord(data.spendSubscriptionCredit);
  if (payload === null) return { ok: false, reason: "unexpected_response" };

  const error = asRecord(payload.error);
  if (error !== null) {
    return { ok: false, reason: typeof error.code === "string" ? error.code : "unknown_error" };
  }

  const benefit = asRecord(payload.subscriptionBenefit);
  if (benefit === null) return { ok: false, reason: "unexpected_response" };
  if (benefit.purchasedWithPrime !== true) {
    return { ok: false, reason: "not_purchased_with_prime" };
  }
  return { ok: true, tier: typeof benefit.tier === "string" ? benefit.tier : null };
}
