import { describe, expect, it } from "vitest";
import { extractTwitchUsername } from "../src/lib/twitch.js";

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
