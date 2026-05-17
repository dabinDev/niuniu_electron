import { beforeEach, describe, expect, it } from "vitest";
import { getMachineCodeInfo } from "./machineCode";

describe("getMachineCodeInfo", () => {
  beforeEach(() => {
    Object.defineProperty(window, "niuniu", {
      configurable: true,
      value: undefined
    });
    window.localStorage.clear();
  });

  it("uses the Electron machine code bridge when available", async () => {
    Object.defineProperty(window, "niuniu", {
      configurable: true,
      value: {
        appName: "NiuNiu",
        getMachineCode: async () => ({ machineCode: "NN-BRIDGE", version: "win-v1" })
      }
    });

    await expect(getMachineCodeInfo()).resolves.toEqual({ machineCode: "NN-BRIDGE", version: "win-v1" });
  });

  it("creates a stable browser fallback for tests and preview", async () => {
    const first = await getMachineCodeInfo();
    const second = await getMachineCodeInfo();

    expect(first.version).toBe("browser-v1");
    expect(first.machineCode).toMatch(/^NN-BROWSER-/);
    expect(second).toEqual(first);
  });
});
