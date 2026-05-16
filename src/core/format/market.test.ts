import { describe, expect, it } from "vitest";
import { formatLimitUpCountLabel } from "./market";

describe("market format helpers", () => {
  it("keeps strength-like decimal percentages out of limit-up counts", () => {
    expect(formatLimitUpCountLabel(8)).toBe("8");
    expect(formatLimitUpCountLabel("8")).toBe("8");
    expect(formatLimitUpCountLabel("15.74%")).toBe("--");
    expect(formatLimitUpCountLabel(15.74)).toBe("--");
    expect(formatLimitUpCountLabel(15740)).toBe("--");
  });
});
