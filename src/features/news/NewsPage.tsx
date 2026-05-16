import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Search, ShieldAlert, Star, Zap } from "lucide-react";
import { useRef, useState } from "react";
import { getString } from "../../core/api/data";
import { queryKeys } from "../../core/api/queryKeys";
import { useApiClient } from "../../core/api/useApiClient";
import { openExternal } from "../../core/desktop/desktopBridge";
import { errorMessage } from "../../core/format/error";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { ExportActions } from "../../shared/components/ExportActions";
import { GlassCard } from "../../shared/components/GlassCard";
import { LoadingState } from "../../shared/components/LoadingState";
import { PageHeader } from "../../shared/components/PageHeader";
import { SegmentedTabs } from "../../shared/components/SegmentedTabs";
import { WorkspaceSummaryBar } from "../../shared/components/WorkspaceSummaryBar";
import { buildNewsViewModel, filterFastNews, groupNewsBySource, scoreNewsHeat, type NewsItem } from "./newsViewModel";

export function NewsPage() {
  const client = useApiClient();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [activeTab, setActiveTab] = useState("hot");
  const [keyword, setKeyword] = useState("");
  const [importantOnly, setImportantOnly] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const query = useQuery({
    queryFn: () => client.getMap(`/api/v1/news/page?tab=${activeTab}&limit=60`),
    queryKey: queryKeys.news(activeTab)
  });

  if (query.isLoading) return <LoadingState title="正在加载牛牛资讯" />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  const data = query.data;
  if (!data) return <EmptyState action="刷新资讯流" description="资讯接口没有返回内容，请确认新闻源服务状态。" title="资讯暂无数据" tone="market" />;
  const model = buildNewsViewModel(data, activeTab);
  const activeCount = model.tabs.find((tab) => tab.key === activeTab)?.count ?? 0;
  const filteredFastNews = filterFastNews(model.fastNews, { importantOnly, keyword });
  const currentMonth = model.monthlyPatterns.find((item) => item.timeLabel === selectedMonth) ?? model.monthlyPatterns[0];

  return (
    <section className="page-scroll" ref={workspaceRef}>
      <PageHeader
        actions={<ExportActions onRefresh={() => query.refetch()} payload={data} targetRef={workspaceRef} title="牛牛资讯" />}
        description="热点新闻、今日热榜、7x24 快讯、财经日历和月份规律，统一成适合复盘阅读的信息流。"
        meta={`${activeCount} 条 · ${model.signal.latestUpdatedAt}`}
        title="牛牛资讯"
      />
      <WorkspaceSummaryBar
        detail={`当前栏目：${model.signal.currentLabel} · ${model.signal.currentFocus}`}
        items={[
          { label: "资讯总量", value: model.signal.totalCount, tone: "blue" },
          { label: "当前栏目", value: activeCount, detail: model.signal.currentLabel, tone: activeCount > 0 ? "up" : "neutral" },
          { label: "重要快讯", value: model.signal.importantCount, tone: model.signal.importantCount > 0 ? "down" : "neutral" },
          { label: "最近更新", value: model.signal.latestUpdatedAt, tone: "amber" }
        ]}
        title="资讯雷达"
      />
      <SegmentedTabs activeKey={activeTab} items={model.tabs} onChange={setActiveTab} />
      {activeTab === "hot" ? <HotNewsPanel items={model.hotNews} title="热点排行榜" /> : null}
      {activeTab === "today-hot" ? <GroupedHotPanel items={model.todayHot} /> : null}
      {activeTab === "724" ? (
        <FastNewsPanel
          importantOnly={importantOnly}
          items={filteredFastNews}
          keyword={keyword}
          onImportantOnlyChange={setImportantOnly}
          onKeywordChange={setKeyword}
        />
      ) : null}
      {activeTab === "timeline" ? <TimelinePanel items={model.timeline} /> : null}
      {activeTab === "monthly" ? <MonthlyPanel current={currentMonth} items={model.monthlyPatterns} onSelect={setSelectedMonth} /> : null}
    </section>
  );
}

function HotNewsPanel({ items, title }: { items: NewsItem[]; title: string }) {
  const maxHeat = maxNewsHeat(items);
  return (
    <GlassCard title={title}>
      <div className="news-rank-list">
        {items.length === 0 ? <EmptyState action="切换资讯分类" description="当前资讯分类没有返回内容，可以切换到 7x24 检查新闻源。" title="暂无资讯" tone="market" /> : null}
        {items.map((item, index) => (
          <NewsRankItem heatMax={maxHeat} index={index} item={item} key={`${item.titleLabel}-${index}`} />
        ))}
      </div>
    </GlassCard>
  );
}

function GroupedHotPanel({ items }: { items: NewsItem[] }) {
  const groups = groupNewsBySource(items);
  const maxHeat = maxNewsHeat(items);
  return (
    <section className="news-group-grid">
      {groups.length === 0 ? <GlassCard title="今日热榜"><EmptyState action="刷新资讯" description="今日热榜暂无分组内容。" title="暂无热榜" tone="market" /></GlassCard> : null}
      {groups.map((group) => (
        <GlassCard eyebrow={`${group.items.length} 条`} key={group.source} title={group.source}>
          <div className="news-rank-list compact">
            {group.items.map((item, index) => (
              <NewsRankItem heatMax={maxHeat} index={index} item={item} key={`${group.source}-${item.titleLabel}-${index}`} />
            ))}
          </div>
        </GlassCard>
      ))}
    </section>
  );
}

function FastNewsPanel({
  importantOnly,
  items,
  keyword,
  onImportantOnlyChange,
  onKeywordChange
}: {
  importantOnly: boolean;
  items: NewsItem[];
  keyword: string;
  onImportantOnlyChange: (value: boolean) => void;
  onKeywordChange: (value: string) => void;
}) {
  const quickKeywords = ["算力", "芯片", "机器人", "AI", "并购", "低空", "监管"];
  return (
    <GlassCard
      actions={
        <button className={`ghost-button icon-label small ${importantOnly ? "active" : ""}`} onClick={() => onImportantOnlyChange(!importantOnly)} type="button">
          <ShieldAlert size={14} />
          重要
        </button>
      }
      title="7x24 消息中心"
    >
      <div className="news-toolbar">
        <label className="news-search">
          <Search size={15} />
          <input onChange={(event) => onKeywordChange(event.target.value)} placeholder="搜索关键词 / 题材 / 来源" value={keyword} />
        </label>
        <div className="quick-keywords">
          {quickKeywords.map((word) => (
            <button className={keyword === word ? "selected" : ""} key={word} onClick={() => onKeywordChange(word)} type="button">
              {word}
            </button>
          ))}
        </div>
      </div>
      <div className="fast-news-list">
        {items.length === 0 ? <EmptyState action="清空过滤条件" description="当前关键词或重要筛选没有命中快讯。" title="暂无快讯" tone="market" /> : null}
        {items.map((item, index) => (
          <NewsMessageItem item={item} key={`${item.titleLabel}-${item.timeLabel}-${index}`} />
        ))}
      </div>
    </GlassCard>
  );
}

function TimelinePanel({ items }: { items: NewsItem[] }) {
  return (
    <GlassCard title="财经日历时间轴">
      <div className="calendar-timeline">
        {items.length === 0 ? <EmptyState action="刷新财经日历" description="财经日历暂时没有返回事件。" title="暂无日历" tone="market" /> : null}
        {items.map((item, index) => (
          <article className={getString(item, "importance", "") === "高" ? "important" : ""} key={`${item.titleLabel}-${index}`}>
            <time>{item.timeLabel}</time>
            <div>
              <b>{item.titleLabel}</b>
              <p>{item.summary}</p>
              <span>{item.sourceLabel}</span>
            </div>
          </article>
        ))}
      </div>
    </GlassCard>
  );
}

function MonthlyPanel({ current, items, onSelect }: { current?: NewsItem; items: NewsItem[]; onSelect: (month: string) => void }) {
  return (
    <section className="monthly-workspace">
      <GlassCard title="月份">
        <div className="month-list">
          {items.map((item) => (
            <button className={current?.timeLabel === item.timeLabel ? "selected" : ""} key={item.timeLabel} onClick={() => onSelect(item.timeLabel)} type="button">
              <span>{item.timeLabel}</span>
              <b>{item.titleLabel}</b>
            </button>
          ))}
        </div>
      </GlassCard>
      <GlassCard eyebrow={current?.sourceLabel ?? "月份规律"} title={current?.timeLabel ?? "月份规律"}>
        {current ? (
          <div className="monthly-detail">
            <div className="monthly-score">
              <Star size={18} />
              <strong>{current.titleLabel}</strong>
            </div>
            <p>{current.summary}</p>
            <span>{getString(current, "extra", getString(current, "driver", "季节性规律"))}</span>
          </div>
        ) : (
          <EmptyState action="选择月份" description="月份规律暂无内容。" title="暂无规律" tone="market" />
        )}
      </GlassCard>
    </section>
  );
}

function NewsRankItem({ heatMax, index, item }: { heatMax: number; index: number; item: NewsItem }) {
  const heat = getString(item, "heat", getString(item, "hot_value", getString(item, "score", "")));
  const heatWidth = Math.min(100, Math.max(16, (scoreNewsHeat(item, index) / heatMax) * 100));
  return (
    <article className={index < 3 ? "top-story" : ""} style={{ "--news-heat": `${heatWidth}%` } as React.CSSProperties}>
      <span className={`rank-badge ${index < 3 ? "top" : ""}`}>{index + 1}</span>
      <div>
        <b>{item.titleLabel}</b>
        <p>{item.summary}</p>
        <small>{item.timeLabel} · {item.sourceLabel}</small>
        <i className="news-heat-meter" />
      </div>
      {heat && heat !== "--" ? <em className="heat-pill">热度 {heat}</em> : null}
      <ExternalAction item={item} />
    </article>
  );
}

function maxNewsHeat(items: NewsItem[]): number {
  return Math.max(...items.map((item, index) => scoreNewsHeat(item, index)), 1);
}

function NewsMessageItem({ item }: { item: NewsItem }) {
  const heatWidth = Math.min(100, Math.max(14, scoreNewsHeat(item, item.isImportant ? 0 : 6) * 0.7));
  return (
    <article className={item.isImportant ? "important" : ""} style={{ "--news-heat": `${heatWidth}%` } as React.CSSProperties}>
      <time>{item.timeLabel}</time>
      <div>
        <b>
          {item.isImportant ? <Zap size={14} /> : null}
          {item.titleLabel}
        </b>
        <p>{item.summary}</p>
        <span>{item.sourceLabel}</span>
        <i className="news-heat-meter" />
      </div>
      <ExternalAction item={item} />
    </article>
  );
}

function ExternalAction({ item }: { item: NewsItem }) {
  const url = getString(item, "url", "");
  if (!url || url === "--") {
    return null;
  }
  return (
    <button className="icon-button" onClick={() => openExternal(url)} type="button">
      <ExternalLink size={15} />
    </button>
  );
}
