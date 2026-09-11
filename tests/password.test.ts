import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../server/password.js";

describe("password hashing", () => {
  it("verifies the password it hashed", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("correct horse battery");
    expect(verifyPassword("wrong horse battery", stored)).toBe(false);
  });

  it("salts every hash", () => {
    expect(hashPassword("same-password")).not.toBe(hashPassword("same-password"));
  });

  it("rejects legacy salt-less hashes without throwing", () => {
    const legacy = "ab".repeat(64);
    expect(verifyPassword("anything", legacy)).toBe(false);
  });
});
