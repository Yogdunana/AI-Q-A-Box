import { describe, expect, it } from "vitest";
import { normalizeSlug, QUESTION_MAX, validateEmail, validatePassword, validateQuestion, validateSlug } from "./validation";

describe("slug rules", () => {
  it("normalizes free text into a slug", () => {
    expect(normalizeSlug("  Lin Yi_Design ")).toBe("lin-yi-design");
    expect(normalizeSlug("A--B!!c")).toBe("a-bc");
  });

  it("rejects malformed, short and reserved slugs", () => {
    expect(validateSlug("")).not.toBeNull();
    expect(validateSlug("ab")).not.toBeNull();
    expect(validateSlug("-lin")).not.toBeNull();
    expect(validateSlug("lin-")).not.toBeNull();
    expect(validateSlug("app")).toMatch(/保留/);
    expect(validateSlug("auth")).toMatch(/保留/);
    expect(validateSlug("lin-yi")).toBeNull();
  });
});

describe("question rules", () => {
  it("requires non-blank content within the limit", () => {
    expect(validateQuestion("   ")).not.toBeNull();
    expect(validateQuestion("好")).not.toBeNull();
    expect(validateQuestion("x".repeat(QUESTION_MAX + 1))).not.toBeNull();
    expect(validateQuestion("你好吗？")).toBeNull();
  });
});

describe("credentials", () => {
  it("validates email and password", () => {
    expect(validateEmail("nope")).not.toBeNull();
    expect(validateEmail("a@b.co")).toBeNull();
    expect(validatePassword("short")).not.toBeNull();
    expect(validatePassword("long-enough")).toBeNull();
  });
});
