import { describe, expect, it } from "vitest";
import {
  buildSpendSubscriptionCreditRequest,
  decidePrimeSubRedemption,
  latestPrimeSubMonth,
  readSpendSubscriptionCreditResponse,
  utcMonthKey,
  type PrimeSubEligibility,
} from "../server/primeSub.js";

const eligible: PrimeSubEligibility = {
  armed: true,
  hasPrime: true,
  canPrimeSubscribe: true,
  subscriptionTier: null,
  lastPrimeSubMonth: null,
  currentMonth: "2026-09",
};

describe("utcMonthKey", () => {
  it("formats a date as a UTC YYYY-MM key", () => {
    expect(utcMonthKey(new Date("2026-09-16T22:14:00.000Z"))).toBe("2026-09");
    expect(utcMonthKey(new Date("2026-01-01T00:00:00.000Z"))).toBe("2026-01");
  });

  it("uses the UTC month even when local time is in the previous month", () => {
    expect(utcMonthKey(new Date("2026-10-01T00:30:00.000Z"))).toBe("2026-10");
  });
});

describe("decidePrimeSubRedemption", () => {
  it("redeems when the account has Prime, the channel is eligible and no credit was spent this month", () => {
    expect(decidePrimeSubRedemption(eligible)).toEqual({ redeem: true });
  });

  it("refuses when the streamer is not armed", () => {
    expect(decidePrimeSubRedemption({ ...eligible, armed: false })).toEqual({
      redeem: false,
      reason: "not_armed",
    });
  });

  it("refuses when the account has no Prime", () => {
    expect(decidePrimeSubRedemption({ ...eligible, hasPrime: false })).toEqual({
      redeem: false,
      reason: "no_prime",
    });
  });

  it("refuses when a subscription to the channel already exists", () => {
    expect(decidePrimeSubRedemption({ ...eligible, subscriptionTier: "1000" })).toEqual({
      redeem: false,
      reason: "already_subscribed",
    });
    expect(decidePrimeSubRedemption({ ...eligible, subscriptionTier: "prime" })).toEqual({
      redeem: false,
      reason: "already_subscribed",
    });
  });

  it("refuses when a credit was already spent in the current UTC month", () => {
    expect(decidePrimeSubRedemption({ ...eligible, lastPrimeSubMonth: "2026-09" })).toEqual({
      redeem: false,
      reason: "already_spent_this_month",
    });
  });

  it("redeems again once the month rolls over", () => {
    expect(decidePrimeSubRedemption({ ...eligible, lastPrimeSubMonth: "2026-08" })).toEqual({
      redeem: true,
    });
  });

  it("refuses when Twitch reports the channel cannot be subscribed to via Prime", () => {
    expect(decidePrimeSubRedemption({ ...eligible, canPrimeSubscribe: false })).toEqual({
      redeem: false,
      reason: "channel_not_eligible",
    });
  });

  it("reports the spent credit rather than channel eligibility when both block", () => {
    expect(
      decidePrimeSubRedemption({
        ...eligible,
        canPrimeSubscribe: false,
        lastPrimeSubMonth: "2026-09",
      }),
    ).toEqual({ redeem: false, reason: "already_spent_this_month" });
  });
});

describe("latestPrimeSubMonth", () => {
  it("reports the most recent month any channel spent the account credit", () => {
    expect(
      latestPrimeSubMonth([
        { lastPrimeSubMonth: "2026-08" },
        { lastPrimeSubMonth: "2026-09" },
        { lastPrimeSubMonth: null },
      ]),
    ).toBe("2026-09");
  });

  it("is null when no channel has ever spent a credit", () => {
    expect(latestPrimeSubMonth([{ lastPrimeSubMonth: null }, {}])).toBeNull();
  });

  it("blocks a freshly armed channel when another channel already spent this month", () => {
    const target = { lastPrimeSubMonth: null };
    const other = { lastPrimeSubMonth: "2026-09" };
    expect(
      decidePrimeSubRedemption({
        ...eligible,
        lastPrimeSubMonth: latestPrimeSubMonth([target, other]),
      }),
    ).toEqual({ redeem: false, reason: "already_spent_this_month" });
  });
});

describe("buildSpendSubscriptionCreditRequest", () => {
  it("targets the Prime credit mutation with only the broadcaster and user ids", () => {
    const request = buildSpendSubscriptionCreditRequest("44741426", "37441513");
    expect(request.variables).toEqual({
      input: { broadcasterID: "44741426", userID: "37441513" },
    });
    expect(Object.keys(request.variables.input)).toEqual(["broadcasterID", "userID"]);
    expect(request.query).toContain("spendSubscriptionCredit");
    expect(request.query).toContain("SpendSubscriptionCreditInput!");
  });

  it("never sends a variable that could charge real money", () => {
    const variables = JSON.stringify(
      buildSpendSubscriptionCreditRequest("1", "2").variables,
    ).toLowerCase();
    for (const forbidden of [
      "price",
      "product",
      "tier",
      "payment",
      "amount",
      "currency",
      "checkout",
      "purchase",
      "gift",
      "recurring",
    ]) {
      expect(variables).not.toContain(forbidden);
    }
  });

  it("declares no operation input beyond the Prime credit input", () => {
    const query = buildSpendSubscriptionCreditRequest("1", "2").query;
    expect(query.match(/\$[a-zA-Z]+:/g)).toEqual(["$input:"]);
    for (const forbidden of ["price", "payment", "amount", "currency", "checkout", "recurring"]) {
      expect(query.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe("readSpendSubscriptionCreditResponse", () => {
  it("accepts a benefit that Twitch confirms was purchased with Prime", () => {
    expect(
      readSpendSubscriptionCreditResponse({
        data: {
          spendSubscriptionCredit: {
            userID: "37441513",
            error: null,
            subscriptionBenefit: { tier: "1000", purchasedWithPrime: true },
          },
        },
      }),
    ).toEqual({ ok: true, tier: "1000" });
  });

  it("reports no tier rather than inventing one when Twitch omits it", () => {
    expect(
      readSpendSubscriptionCreditResponse({
        data: {
          spendSubscriptionCredit: {
            error: null,
            subscriptionBenefit: { purchasedWithPrime: true },
          },
        },
      }),
    ).toEqual({ ok: true, tier: null });
  });

  it("rejects a benefit that was not purchased with Prime", () => {
    expect(
      readSpendSubscriptionCreditResponse({
        data: {
          spendSubscriptionCredit: {
            userID: "37441513",
            error: null,
            subscriptionBenefit: { tier: "1000", purchasedWithPrime: false },
          },
        },
      }),
    ).toEqual({ ok: false, reason: "not_purchased_with_prime" });
  });

  it("maps the credit error codes Twitch can return", () => {
    expect(
      readSpendSubscriptionCreditResponse({
        data: { spendSubscriptionCredit: { error: { code: "UNABLE_TO_SPEND" } } },
      }),
    ).toEqual({ ok: false, reason: "UNABLE_TO_SPEND" });
    expect(
      readSpendSubscriptionCreditResponse({
        data: { spendSubscriptionCredit: { error: { code: "TOO_MANY_RECENT_SPENDS" } } },
      }),
    ).toEqual({ ok: false, reason: "TOO_MANY_RECENT_SPENDS" });
  });

  it("rejects a response carrying GraphQL errors", () => {
    expect(
      readSpendSubscriptionCreditResponse({
        errors: [{ message: "service error" }],
        data: {
          spendSubscriptionCredit: {
            error: null,
            subscriptionBenefit: { tier: "1000", purchasedWithPrime: true },
          },
        },
      }),
    ).toEqual({ ok: false, reason: "gql_error" });
  });

  it("rejects anything it cannot recognise", () => {
    expect(readSpendSubscriptionCreditResponse(null)).toEqual({
      ok: false,
      reason: "unexpected_response",
    });
    expect(readSpendSubscriptionCreditResponse({ data: {} })).toEqual({
      ok: false,
      reason: "unexpected_response",
    });
    expect(
      readSpendSubscriptionCreditResponse({
        data: { spendSubscriptionCredit: { error: null, subscriptionBenefit: null } },
      }),
    ).toEqual({ ok: false, reason: "unexpected_response" });
  });
});
