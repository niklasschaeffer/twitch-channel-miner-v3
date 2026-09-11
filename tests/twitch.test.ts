import { describe, expect, it } from "vitest";
import { extractTwitchUsername, supportsChannelPoints } from "../src/lib/twitch.js";

describe("supportsChannelPoints", () => {
  it("trusts Twitch's channel points setting when it is known", () => {
    expect(
      supportsChannelPoints({ channelPointsEnabled: false, isPartner: true, isAffiliate: false }),
    ).toBe(false);
    expect(
      supportsChannelPoints({ channelPointsEnabled: true, isPartner: false, isAffiliate: false }),
    ).toBe(true);
  });

  it("falls back to partner or affiliate status before the setting is fetched", () => {
    expect(supportsChannelPoints({ isPartner: false, isAffiliate: false })).toBe(false);
    expect(
      supportsChannelPoints({ channelPointsEnabled: null, isPartner: false, isAffiliate: true }),
    ).toBe(true);
    expect(supportsChannelPoints({ isPartner: true, isAffiliate: false })).toBe(true);
  });
});

describe("extractTwitchUsername", () => {
  it("returns plain logins unchanged", () => {
    expect(extractTwitchUsername("nickeygod")).toBe("nickeygod");
  });

  it("lowercases mixed-case input", () => {
    expect(extractTwitchUsername("NikeyGod")).toBe("nikeygod");
  });

  it("extracts from full twitch.tv URLs", () => {
    expect(extractTwitchUsername("https://www.twitch.tv/nickeygod")).toBe("nickeygod");
    expect(extractTwitchUsername("http://twitch.tv/nickeygod")).toBe("nickeygod");
    expect(extractTwitchUsername("https://m.twitch.tv/nickeygod")).toBe("nickeygod");
  });

  it("strips @ prefixes and query/hash fragments", () => {
    expect(extractTwitchUsername("@nickeygod")).toBe("nickeygod");
    expect(extractTwitchUsername("twitch.tv/nickeygod?filter=all#top")).toBe("nickeygod");
  });

  it("trims surrounding whitespace and trailing slashes", () => {
    expect(extractTwitchUsername("  nickeygod/  ")).toBe("nickeygod");
  });

  it("returns empty string for empty input", () => {
    expect(extractTwitchUsername("")).toBe("");
  });

  it("caps at 35 characters like Twitch login rules", () => {
    const long = "a".repeat(40);
    expect(extractTwitchUsername(long)).toBe("a".repeat(35));
  });
});
