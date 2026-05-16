import { getOptionalString, getRecords, getString } from "../../core/api/data";

export type NewsTabKey = "724" | "hot" | "monthly" | "timeline" | "today-hot";

export type NewsItem = Record<string, unknown> & {
  isImportant?: boolean;
  sourceLabel: string;
  summary: string;
  timeLabel: string;
  titleLabel: string;
};

export type NewsViewModel = {
  fastNews: NewsItem[];
  hotNews: NewsItem[];
  monthlyPatterns: NewsItem[];
  signal: {
    currentFocus: string;
    currentLabel: string;
    importantCount: number;
    latestUpdatedAt: string;
    totalCount: number;
  };
  tabs: Array<{ count: number; key: NewsTabKey; label: string; tone?: "down" | "neutral" | "up" }>;
  timeline: NewsItem[];
  todayHot: NewsItem[];
};

const tabLabels: Record<NewsTabKey, string> = {
  "724": "7x24",
  hot: "热点",
  monthly: "月份规律",
  timeline: "财经日历",
  "today-hot": "今日热榜"
};

export function buildNewsViewModel(data: Record<string, unknown>, activeTab: string): NewsViewModel {
  const hotNews = normalizeNewsItems(getRecords(data.hot_news as Record<string, unknown>, "items"));
  const todayHot = normalizeNewsItems(getRecords(data.today_hot as Record<string, unknown>, "items"));
  const fastNews = normalizeNewsItems(getRecords(data.fast_news as Record<string, unknown>, "items"));
  const timeline = normalizeNewsItems(getRecords(data.timeline as Record<string, unknown>, "items"));
  const monthlyPatterns = normalizeNewsItems(getRecords(data, "monthly_patterns"));
  const activeKey = normalizeTabKey(activeTab);
  const activeItems = tabItems(activeKey, { fastNews, hotNews, monthlyPatterns, timeline, todayHot });
  const importantCount = fastNews.filter((item) => item.isImportant).length;
  const latestUpdatedAt = firstPresent(
    activeKey === "724" ? getOptionalString(data.fast_news as Record<string, unknown>, "fetched_at") : undefined,
    activeKey === "hot" ? getOptionalString(data.hot_news as Record<string, unknown>, "fetched_at") : undefined,
    activeKey === "today-hot" ? getOptionalString(data.today_hot as Record<string, unknown>, "fetched_at") : undefined,
    activeKey === "timeline" ? getOptionalString(data.timeline as Record<string, unknown>, "fetched_at") : undefined,
    getOptionalString(data.fast_news as Record<string, unknown>, "fetched_at"),
    getOptionalString(data.hot_news as Record<string, unknown>, "fetched_at"),
    "--"
  );

  return {
    fastNews,
    hotNews,
    monthlyPatterns,
    signal: {
      currentFocus: activeItems[0]?.titleLabel ?? "等待资讯更新",
      currentLabel: tabLabels[activeKey],
      importantCount,
      latestUpdatedAt,
      totalCount: hotNews.length + todayHot.length + fastNews.length + timeline.length + monthlyPatterns.length
    },
    tabs: [
      { count: hotNews.length, key: "hot", label: "热点", tone: "up" },
      { count: todayHot.length, key: "today-hot", label: "今日热榜", tone: "up" },
      { count: fastNews.length, key: "724", label: "7x24", tone: importantCount > 0 ? "down" : "neutral" },
      { count: timeline.length, key: "timeline", label: "财经日历", tone: "neutral" },
      { count: monthlyPatterns.length, key: "monthly", label: "月份规律", tone: "neutral" }
    ],
    timeline,
    todayHot
  };
}

export function filterFastNews(items: NewsItem[], options: { importantOnly?: boolean; keyword?: string }): NewsItem[] {
  const keyword = options.keyword?.trim().toLowerCase() ?? "";
  return items.filter((item) => {
    if (options.importantOnly && !item.isImportant) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    return [item.titleLabel, item.summary, item.sourceLabel, getString(item, "content", "")]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  });
}

export function groupNewsBySource(items: NewsItem[]): Array<{ items: NewsItem[]; source: string }> {
  const groups = new Map<string, NewsItem[]>();
  items.forEach((item) => {
    const key = getString(item, "group", item.sourceLabel || "未分组");
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return Array.from(groups, ([source, groupedItems]) => ({ items: groupedItems, source }));
}

export function scoreNewsHeat(item: NewsItem, index: number): number {
  const rawHeat = Number(getString(item, "heat", getString(item, "hot_value", getString(item, "score", "0"))).replace(/[,%]/g, ""));
  const numericHeat = Number.isFinite(rawHeat) ? rawHeat : 0;
  const rankWeight = Math.max(0, 100 - index * 9);
  const importantWeight = item.isImportant ? 92 : 0;
  const titleWeight = Math.min(24, item.titleLabel.length * 0.8);
  return numericHeat / 80 + rankWeight + importantWeight + titleWeight;
}

function normalizeNewsItems(items: Array<Record<string, unknown>>): NewsItem[] {
  return items.map((item) => ({
    ...item,
    isImportant: item.is_important === true || item.is_important === "true" || item.important === true || item.important === "true",
    sourceLabel: getString(item, "source", getString(item, "group", getString(item, "driver", "牛牛资讯"))),
    summary: getString(item, "content", getString(item, "subtitle", getString(item, "analysis", getString(item, "strategy", "")))),
    timeLabel: getString(item, "time", getString(item, "month", "--")),
    titleLabel: getString(item, "title", getString(item, "trend", getString(item, "month", "--")))
  }));
}

function normalizeTabKey(value: string): NewsTabKey {
  return value === "724" || value === "today-hot" || value === "timeline" || value === "monthly" ? value : "hot";
}

function tabItems(
  key: NewsTabKey,
  groups: Pick<NewsViewModel, "fastNews" | "hotNews" | "monthlyPatterns" | "timeline" | "todayHot">
): NewsItem[] {
  if (key === "724") return groups.fastNews;
  if (key === "today-hot") return groups.todayHot;
  if (key === "timeline") return groups.timeline;
  if (key === "monthly") return groups.monthlyPatterns;
  return groups.hotNews;
}

function firstPresent(...values: Array<string | undefined>): string {
  return values.find((value) => value && value !== "--") ?? "--";
}
