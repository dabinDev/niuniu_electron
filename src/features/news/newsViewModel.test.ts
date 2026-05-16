import { describe, expect, it } from "vitest";
import { buildNewsViewModel, filterFastNews, scoreNewsHeat } from "./newsViewModel";

const data = {
  hot_news: {
    fetched_at: "2026-05-14 13:28:00",
    items: [
      { title: "算力服务器订单增长", time: "13:20", heat: 3200, source: "热榜" },
      { title: "芯片产业链回流", time: "11:10", heat: 1800, source: "热榜" }
    ]
  },
  today_hot: {
    items: [{ title: "机器人板块活跃", group: "产业", heat: 900 }]
  },
  fast_news: {
    fetched_at: "2026-05-14 13:29:00",
    items: [
      { title: "算力概念午后拉升", content: "多只高标涨停", time: "2026-05-14 13:25:55", source: "7x24", is_important: true },
      { title: "海外市场震荡", content: "指数回落", time: "2026-05-14 10:12:00", source: "7x24", is_important: false }
    ]
  },
  timeline: {
    items: [{ title: "央行发布数据", time: "09:30", importance: "高" }]
  },
  monthly_patterns: [
    { month: "1月", trend: "中等", strategy: "资金回流" },
    { month: "2月", trend: "极高", strategy: "春季躁动" }
  ]
};

describe("newsViewModel", () => {
  it("builds signal metrics for the news radar", () => {
    const model = buildNewsViewModel(data, "724");

    expect(model.signal.currentLabel).toBe("7x24");
    expect(model.signal.totalCount).toBe(8);
    expect(model.signal.importantCount).toBe(1);
    expect(model.signal.latestUpdatedAt).toBe("2026-05-14 13:29:00");
    expect(model.tabs.find((tab) => tab.key === "monthly")?.count).toBe(2);
  });

  it("filters 7x24 news by keyword and important-only mode", () => {
    const model = buildNewsViewModel(data, "724");

    expect(filterFastNews(model.fastNews, { keyword: "算力", importantOnly: true })).toHaveLength(1);
    expect(filterFastNews(model.fastNews, { keyword: "海外", importantOnly: true })).toHaveLength(0);
  });

  it("scores news heat for visual emphasis", () => {
    const model = buildNewsViewModel(data, "724");

    expect(scoreNewsHeat(model.hotNews[0], 0)).toBeGreaterThan(scoreNewsHeat(model.hotNews[1], 1));
    expect(scoreNewsHeat(model.fastNews[0], 8)).toBeGreaterThan(scoreNewsHeat(model.fastNews[1], 0));
  });
});
