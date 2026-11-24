import { describe, expect, it } from "vitest";
import { meatLots, normalizeMeat, parseMeatKey } from "./market";

describe("肉品库存归一化", () => {
  it("拒绝原型链键，避免 UI 读到不存在的物种", () => {
    expect(parseMeatKey("toString")).toBeNull();
    expect(parseMeatKey("constructor:metal")).toBeNull();
    expect(normalizeMeat({ toString: 2, constructor: 1 })).toEqual({});
  });

  it("保留合法物种与元素并夹取份数", () => {
    expect(normalizeMeat({ wolf: 2, "wolf:metal": 3.9, "unknown:fire": 5, "wolf:nope": 1 }))
      .toEqual({ wolf: 2, "wolf:metal": 3 });
    expect(meatLots({ "wolf:metal": 3 }).map((lot) => lot.name)).toEqual(["鎏金·灰狼肉"]);
  });

  it("肉品价不会出现 NaN", () => {
    for (const lot of meatLots(normalizeMeat({ "panda:water": 4 }))) {
      expect(Number.isFinite(lot.price)).toBe(true);
      expect(lot.price).toBeGreaterThan(0);
    }
  });
});
