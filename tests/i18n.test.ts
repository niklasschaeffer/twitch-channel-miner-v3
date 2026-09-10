import { describe, expect, it } from "vitest";
import { resources } from "../src/i18n.js";

type TranslationNode = string | { [key: string]: TranslationNode };

function flatten(node: TranslationNode, prefix = ""): string[] {
  if (typeof node === "string") return prefix ? [prefix] : [];
  return Object.entries(node).flatMap(([key, value]) =>
    flatten(value, prefix ? `${prefix}.${key}` : key),
  );
}

function collectInterpolations(node: TranslationNode): string[] {
  if (typeof node === "string") {
    return [...node.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  }
  return Object.values(node).flatMap(collectInterpolations);
}

describe("i18n resources", () => {
  const en = resources.en.translation as TranslationNode;
  const de = resources.de.translation as TranslationNode;

  it("de has exactly the same key tree as en", () => {
    const enKeys = flatten(en).sort();
    const deKeys = flatten(de).sort();
    expect(deKeys).toEqual(enKeys);
  });

  it("both locales are non-empty", () => {
    expect(flatten(en).length).toBeGreaterThan(100);
    expect(flatten(de).length).toBeGreaterThan(100);
  });

  it("matching keys use the same interpolation placeholders", () => {
    const enKeys = new Set(flatten(en));
    const deKeys = new Set(flatten(de));
    const shared = [...enKeys].filter((k) => deKeys.has(k));
    expect(shared.length).toBeGreaterThan(100);

    const enFlat = Object.fromEntries(
      flatten(en).map((k) => [
        k,
        k.split(".").reduce<TranslationNode>((n, part) => {
          if (typeof n === "string" || n === undefined) throw new Error("unreachable");
          return n[part];
        }, en),
      ]),
    );

    for (const key of shared) {
      const enValue = enFlat[key];
      const deValue = key.split(".").reduce<TranslationNode>((n, part) => {
        if (typeof n === "string" || n === undefined) throw new Error("unreachable");
        return n[part];
      }, de);
      expect(collectInterpolations(deValue).sort()).toEqual(collectInterpolations(enValue).sort());
    }
  });
});
