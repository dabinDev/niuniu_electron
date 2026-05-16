import { describe, expect, it } from "vitest";
import { boardTierPath, limitReviewPath, yesterdayStatsPath } from "./apiPaths";

describe("feature API paths", () => {
  it("keeps list limits inside FastAPI query constraints", () => {
    expect(yesterdayStatsPath({ limit: 80 })).toBe("/api/v1/yesterday/stats?limit=40");
    expect(boardTierPath({ stockLimit: 80, tierLimit: 99 })).toBe("/api/v1/lianban/tiers?stock_limit=40&tier_limit=16");
    expect(limitReviewPath({ weaknessLimit: 60 })).toBe("/api/v1/review-page?weakness_limit=40");
  });
});
