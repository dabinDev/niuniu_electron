import { describe, expect, it } from "vitest";
import { navigationItems, visibleNavigationItems } from "./navigation";

describe("navigationItems", () => {
  it("orders the sidebar by short-term trader decision priority", () => {
    expect(navigationItems.map((item) => item.path)).toEqual([
      "/overview",
      "/auction",
      "/board-tier",
      "/board-height",
      "/limit-review",
      "/plate-rotation",
      "/node",
      "/market-center",
      "/news",
      "/ask-ai",
      "/jobs"
    ]);
  });

  it("has compact collapsed marks for sidebar display", () => {
    expect(navigationItems.map((item) => item.mark)).toEqual(["总", "竞", "梯", "高", "复", "板", "节", "行", "讯", "智", "任"]);
  });

  it("keeps the question workspace named as strategy support rather than AI branding", () => {
    const askItem = navigationItems.find((item) => item.path === "/ask-ai");

    expect(askItem?.label).toBe("策略问答");
    expect(askItem?.description).toBe("复盘上下文、策略问答和历史记录");
  });

  it("hides the task center from non-admin client activations", () => {
    expect(visibleNavigationItems(undefined).map((item) => item.path)).not.toContain("/jobs");
    expect(visibleNavigationItems({ accessRole: "user" }).map((item) => item.path)).not.toContain("/jobs");
    expect(visibleNavigationItems({ accessRole: "admin" }).map((item) => item.path)).toContain("/jobs");
    expect(visibleNavigationItems({ accessRole: "owner" }).map((item) => item.path)).toContain("/jobs");
  });
});
