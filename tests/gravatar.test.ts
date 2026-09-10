import { describe, expect, it } from "vitest";
import { md5, getGravatarUrl } from "../src/lib/gravatar.js";

describe("md5", () => {
  it("matches RFC 1321 known vectors", () => {
    expect(md5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5("a")).toBe("0cc175b9c0f1b6a831c399e269772661");
    expect(md5("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(md5("message digest")).toBe("f96b697d7cb7938d525a2f31aaf161d0");
    expect(md5("abcdefghijklmnopqrstuvwxyz")).toBe("c3fcd3d76192e4007dfb496cca67e13b");
  });
});

describe("getGravatarUrl", () => {
  it("hashes normalized email into the gravatar url", () => {
    const url = getGravatarUrl("niklass.schaeffer@gmail.com", 200);
    expect(url).toContain("gravatar.com/avatar/");
    expect(url).toContain("s=200");
    expect(url).toBe(getGravatarUrl("  Niklass.Schaeffer@Gmail.COM  ", 200));
  });

  it("falls back to dicebear identicon for empty email", () => {
    expect(getGravatarUrl("")).toContain("dicebear.com");
  });
});
