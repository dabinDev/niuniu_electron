import { describe, expect, it } from "vitest";
import { navigationItems } from "./navigation";

describe("navigationItems", () => {
  it("keeps market-adjacent data grouped under the market center in left-sidebar order", () => {
    expect(navigationItems.map((item) => item.path)).toEqual([
      "/overview",
      "/auction",
      "/node",
      "/market-center",
      "/board-tier",
      "/board-height",
      "/limit-review",
      "/plate-rotation",
      "/news",
      "/ask-ai",
      "/jobs"
    ]);
  });

  it("has compact collapsed marks for sidebar display", () => {
    expect(navigationItems.map((item) => item.mark)).toEqual(["总", "竞", "节", "行", "梯", "高", "复", "板", "讯", "AI", "任"]);
  });
});
