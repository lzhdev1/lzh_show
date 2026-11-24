import { describe, expect, it } from "vitest";
import { isActionId } from "./actionMotion";

describe("角色动作 id", () => {
  it("只接受目录里定义的动作，拒绝原型链键", () => {
    expect(isActionId("punch")).toBe(true);
    expect(isActionId("toString")).toBe(false);
    expect(isActionId("constructor")).toBe(false);
  });
});
