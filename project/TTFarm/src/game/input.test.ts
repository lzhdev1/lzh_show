import { describe, expect, it } from "vitest";
import { farmInput, setSprintEnabled, sprintEnabled } from "./input";

describe("farm input sprint default", () => {
  it("starts with sprint enabled", () => {
    expect(sprintEnabled()).toBe(true);
    expect(farmInput.running).toBe(true);
  });

  it("keeps the running flag in sync when sprint is toggled", () => {
    setSprintEnabled(false);
    expect(sprintEnabled()).toBe(false);
    expect(farmInput.running).toBe(false);

    setSprintEnabled(true);
    expect(sprintEnabled()).toBe(true);
    expect(farmInput.running).toBe(true);
  });
});
