import { describe, expect, it } from "vitest";
import { isRegistrationOpen } from "../server/registrationPolicy.js";

describe("isRegistrationOpen", () => {
  it("is open when ALLOW_REGISTRATION is the string true", () => {
    expect(isRegistrationOpen("true", 5)).toBe(true);
  });

  it("is open when there are zero users regardless of the env value", () => {
    expect(isRegistrationOpen(undefined, 0)).toBe(true);
    expect(isRegistrationOpen("false", 0)).toBe(true);
  });

  it("is closed when there are existing users and the env value is not true", () => {
    expect(isRegistrationOpen(undefined, 1)).toBe(false);
    expect(isRegistrationOpen("false", 3)).toBe(false);
    expect(isRegistrationOpen("1", 3)).toBe(false);
    expect(isRegistrationOpen("TRUE", 3)).toBe(false);
  });
});
