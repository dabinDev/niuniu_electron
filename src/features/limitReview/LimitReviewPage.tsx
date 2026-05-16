import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { asRecord, buildQuery, columnLabel, getRecord, getRecords, getOptionalString, getString, resolveColumnLabel, stringifyCell, tablesToSheets } from "../../core/api/data";
import { queryKeys } from "../../core/api/queryKeys";
import { useApiClient } from "../../core/api/useApiClient";
import { displayDate, displayDateTime } from "../../core/format/date";
import { errorMessage } from "../../core/format/error";
import { formatPercent } from "../../core/format/number";
import { AiAnalysisPanel } from "../../shared/components/AiAnalysisPanel";
import type { DataColumn, DataRow } from "../../shared/components/DataTable";
import { DataTable } from "../../shared/components/DataTable";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { ExportActions } from "../../shared/components/ExportActions";
import { GlassCard } from "../../shared/components/GlassCard";
import { HeightTrendChart, normalizeHeightTrendItems } from "../../shared/components/HeightTrendChart";
import { LoadingState } from "../../shared/components/LoadingState";
import { MetricCard } from "../../shared/components/MetricCard";
import { PageHeader } from "../../shared/components/PageHeader";
import { StockProfileSheet } from "../../shared/components/StockProfileSheet";
import { TradeDateNavigation } from "../../shared/components/TradeDateNavigation";
import { WorkspaceSummaryBar } from "../../shared/components/WorkspaceSummaryBar";
import { limitReviewPath } from "../apiPaths";
import { buildAskAiClientConfig, buildAskAiSyncPayload, loadAskAiSettings, loadOrCreateAskAiClientId } from "../askAi/askAiSettings";
import { useAiFeatureUsage } from "../askAi/useAiFeatureUsage";

export function LimitReviewPage() {
  const client = useApiClient();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [tradeDate, setTradeDate] = useState<string | undefined>();
  const [activeGroup, setActiveGroup] = useState("");
  const [activeReviewMode, setActiveReviewMode] = useState<ReviewGroupMode>("lianban");
  const [selectedHeightDate, setSelectedHeightDate] = useState("");
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const aiUsage = useAiFeatureUsage("limit_review");
  const query = useQuery({
    queryFn: () => client.getMap(limitReviewPath({ tradeDate, weaknessLimit: 40 })),
    queryKey: queryKeys.limitReview(tradeDate)
  });
  const aiMutation = useMutation({
    mutationFn: async () => {
      const settings = loadAskAiSettings();
      const clientId = aiUsage.clientId || loadOrCreateAskAiClientId();
      if (settings.apiKey) {
        await client.postMap("/api/v1/ask-ai/client-config", buildAskAiSyncPayload(settings, clientId), 12_000);
      }
      return client.postMap(`/api/v1/limit-review/ai-review${buildQuery({ trade_date: tradeDate })}`, {
        client_config: buildAskAiClientConfig(settings, clientId)
      }, 240_000);
    },
    onSuccess: () => {
      void query.refetch();
      void aiUsage.query.refetch();
    }
  });

  if (query.isLoading) {
    return <LoadingState title="正在加载涨停复盘" />;
  }
  if (query.isError) {
    return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  }
  const data = query.data;
  if (!data) {
    return <EmptyState action="刷新涨停复盘" description="涨停复盘没有返回主体数据，请确认复盘接口和交易日参数。" title="复盘暂无数据" tone="market" />;
  }

  const review = getRecord(data, "limit_review");
  const groups = getRecords(review, "groups");
  const boardHeight = getRecord(data, "board_height");
  const heightItems = getRecords(boardHeight, "chart_items");
  const trendItems = normalizeHeightTrendItems(heightItems).slice(-20);
  const latestTrendItem = trendItems.length > 0 ? trendItems[trendItems.length - 1] : undefined;
  const activeHeightDate = selectedHeightDate && trendItems.some((item) => item.date === selectedHeightDate)
    ? selectedHeightDate
    : getString(review, "trade_date", latestTrendItem?.date ?? "");
  const activeHeightItem = trendItems.find((item) => item.date === activeHeightDate) ?? latestTrendItem;
  const activeHeightColumn = getRecords(boardHeight, "columns").find((column) => getString(column, "date") === activeHeightDate);
  const latestHeightItem = heightItems[heightItems.length - 1] ?? {};
  const yesterdayStats = getRecord(data, "yesterday_stats");
  const feedbackSections = getRecords(yesterdayStats, "sections");
  const reviewGroups = groups.map((group) => buildReviewGroupView(group, setSelectedStock));
  const lianbanGroups = reviewGroups.filter((group) => group.mode === "lianban");
  const firstGroups = reviewGroups.filter((group) => group.mode === "first");
  const activeMode = activeReviewMode === "first" && firstGroups.length > 0
    ? "first"
    : activeReviewMode === "lianban" && lianbanGroups.length > 0
      ? "lianban"
      : firstGroups.length > 0
        ? "first"
        : "lianban";
  const modeGroups = activeMode === "first" ? firstGroups : lianbanGroups;
  const currentGroup = modeGroups.find((group) => group.key === activeGroup) ?? modeGroups[0] ?? reviewGroups[0];
  const currentGroupName = currentGroup?.displayName ?? "涨停分组";
  const columns = currentGroup?.columns ?? [];
  const rows = currentGroup?.rows ?? [];
  const modeTabs = [
    { count: groupRowCount(lianbanGroups), key: "lianban" as const, label: "连板" },
    { count: groupRowCount(firstGroups), key: "first" as const, label: "首板" }
  ];
  const sectionSheets = tablesToSheets(
    groups.map((group) => ({
      column_defs: getRecords(group, "columns"),
      items: getRecords(group, "items"),
      key: getString(group, "name"),
      title: displayReviewGroupName(getString(group, "name")),
      total: getString(group, "count", "0")
    }))
  );

  return (
    <section className="page-scroll" ref={workspaceRef}>
      <PageHeader
        actions={<ExportActions onRefresh={() => query.refetch()} payload={data} sheets={sectionSheets} targetRef={workspaceRef} title="涨停复盘" />}
        description="完整接入复盘页接口：涨停分组、连板高度、昨日反馈、弱势结构与 AI 复盘都在同一工作区内查看。"
        meta={`${displayDate(getString(review, "trade_date", ""))} · ${displayDateTime(getString(review, "fetched_at", ""))}`}
        title="涨停复盘"
      />

      <TradeDateNavigation navigation={asRecord(data.navigation)} onChange={setTradeDate} />

      <section className="metric-grid">
        <MetricCard delay={0} label="涨停分组" value={getString(review, "total_groups", "0")} />
        <MetricCard delay={70} label="涨停股票" tone="up" value={getString(review, "total_stocks", "0")} />
        <MetricCard delay={140} label="最高连板" tone="up" value={`${getString(review, "max_board_height", "--")} 板`} />
        <MetricCard delay={210} label="昨日反馈" value={`${feedbackSections.length} 组`} />
      </section>

      <WorkspaceSummaryBar
        detail={`复盘交易日 ${displayDate(getString(review, "trade_date", ""))}`}
        items={[
          { label: "分组", value: getString(review, "total_groups", "0"), tone: "blue" },
          { label: "涨停", value: getString(review, "total_stocks", "0"), tone: "up" },
          { label: "弱势反馈", value: feedbackSections.length, tone: feedbackSections.length > 0 ? "down" : "neutral" },
          { label: "高度", value: `${getString(boardHeight, "latest_height", getString(review, "max_board_height", "--"))} 板`, detail: getString(latestHeightItem, "leader_name", "--"), tone: "amber" }
        ]}
        title="涨停复盘工作台"
      />

      <section className="content-grid limit-review-workbench">
        <GlassCard
          className="review-groups-card"
          eyebrow={`${rows.length} 条`}
          title={currentGroupName}
        >
          <section className="review-groups-workspace" data-testid="review-groups-workspace">
            <div aria-label="涨停复盘类型" className="review-mode-tabs" role="tablist">
              {modeTabs.map((item) => (
                <button
                  aria-selected={activeMode === item.key}
                  className={activeMode === item.key ? "on" : ""}
                  disabled={item.count === 0}
                  key={item.key}
                  onClick={() => {
                    setActiveReviewMode(item.key);
                    setActiveGroup("");
                  }}
                  type="button"
                >
                  <span>{item.label}</span>
                  <b>{item.count}</b>
                </button>
              ))}
            </div>
            <div className="review-groups-body">
              <div aria-label={`${activeMode === "first" ? "首板" : "连板"}分组`} className="review-board-group-list" role="tablist">
                {modeGroups.map((group) => (
                  <button aria-selected={currentGroup?.key === group.key} className={currentGroup?.key === group.key ? "on" : ""} key={group.key} onClick={() => setActiveGroup(group.key)} type="button">
                    <span>{group.displayName}</span>
                    <b>{group.count}</b>
                    <small>{group.rows.length} 只 · {group.summary}</small>
                  </button>
                ))}
                {modeGroups.length === 0 ? <span className="muted-chip">暂无{activeMode === "first" ? "首板" : "连板"}分组</span> : null}
              </div>
              <div className="review-groups-panel">
                <div className="section-meta-strip">
                  <span>{activeMode === "first" ? "首板池" : "连板梯队"}</span>
                  <span>{columns.length} 字段</span>
                  <span>{rows.length} 条样本</span>
                </div>
                {rows.length === 0 ? (
                  <EmptyState action="切换涨停分组" description="当前复盘分组没有股票，可能是该方向今日没有有效样本。" hint={currentGroupName} title="分组暂无数据" tone="market" />
                ) : (
                  <DataTable columns={columns} rows={rows} />
                )}
              </div>
            </div>
          </section>
        </GlassCard>
        <div className="limit-review-ai-panel">
          <AiAnalysisPanel ai={asRecord(data.ai_review)} loading={aiMutation.isPending} onGenerate={() => aiMutation.mutate()} quota={aiUsage.usage} title="AI 涨停复盘" />
        </div>
      </section>

      <section className="content-grid review-detail-grid">
        <GlassCard className="review-height-card" title="连板高度曲线">
          <HeightTrendChart activeDate={activeHeightDate} items={trendItems} onSelectDate={setSelectedHeightDate} />
          <div className="review-height-inspector">
            <article>
              <span>联动日期</span>
              <b data-testid="review-height-active-date">{activeHeightDate || "--"}</b>
              <small>{activeHeightItem ? `${activeHeightItem.value} 板 · ${activeHeightItem.leaderName ?? "--"}` : "点击折线选择日期"}</small>
            </article>
            <div>
              {getRecords(activeHeightColumn ?? {}, "stocks").slice(0, 8).map((stock) => (
                <button className={boardToneClass(Number(stock.board_count ?? 0))} key={`${getString(stock, "code")}-${getString(stock, "name")}`} onClick={() => setSelectedStock(getString(stock, "code", ""))} type="button">
                  <b>{getString(stock, "name")}</b>
                  <span>{getString(stock, "code")}</span>
                </button>
              ))}
              {getRecords(activeHeightColumn ?? {}, "stocks").length === 0 ? <span className="muted-chip">暂无成员</span> : null}
            </div>
          </div>
        </GlassCard>
        <GlassCard title="昨日弱势反馈">
          <div className="weakness-grid">
            {feedbackSections.length === 0 ? <EmptyState description="暂未返回昨日反馈分组。" title="暂无反馈" tone="muted" /> : null}
            {feedbackSections.map((section) => (
              <article key={getString(section, "key")}>
                <span>{feedbackSectionTitle(section)}</span>
                <b>{getString(section, "total", "0")}</b>
                <small>{getRecords(section, "items").slice(0, 2).map((item) => getString(item, "name", getString(item, "stock_name", getString(item, "code", "")))).filter(Boolean).join(" / ") || "等待样本"}</small>
              </article>
            ))}
          </div>
        </GlassCard>
      </section>

      {selectedStock ? <StockProfileSheet onClose={() => setSelectedStock(null)} symbol={selectedStock} /> : null}
    </section>
  );
}

type ReviewGroupMode = "first" | "lianban";

type ReviewGroupView = {
  columns: DataColumn[];
  count: string;
  displayName: string;
  key: string;
  mode: ReviewGroupMode;
  rows: DataRow[];
  summary: string;
};

function buildReviewGroupView(group: Record<string, unknown>, onStockSelect: (code: string) => void): ReviewGroupView {
  const items = getRecords(group, "items");
  const originalColumns = getRecords(group, "columns");
  const originalKeys = originalColumns.map((column) => getString(column, "key"));
  const columns = normalizeReviewColumns(group, items);
  const displayName = displayReviewGroupName(getString(group, "name", "涨停分组"));
  const rows = items.map((item, index) => {
    const cells = Array.isArray(item.cells) ? item.cells.map(String) : [];
    const stockCode = getString(item, "stock_code", getString(item, "code", cells[originalKeys.indexOf("stock_code")] ?? cells[originalKeys.indexOf("code")] ?? ""));
    return {
      id: `${stockCode || displayName}-${index}`,
      onClick: stockCode ? () => onStockSelect(stockCode) : undefined,
      values: Object.fromEntries(columns.map((column) => {
        const cellIndex = originalKeys.indexOf(column.key);
        const value = item[column.key] ?? (cellIndex >= 0 ? cells[cellIndex] : undefined) ?? "--";
        return [column.key, formatReviewCell(column.key, value)];
      }))
    };
  });
  return {
    columns,
    count: getString(group, "count", String(rows.length)),
    displayName,
    key: getString(group, "name", displayName),
    mode: reviewGroupMode(group, items),
    rows,
    summary: reviewGroupSummary(items)
  };
}

function normalizeReviewColumns(group: Record<string, unknown>, items: Record<string, unknown>[]): DataColumn[] {
  const originalColumns = getRecords(group, "columns");
  const itemKeys = Array.from(new Set(items.flatMap((item) => Object.keys(item))));
  const sourceColumns = originalColumns.length > 0
    ? originalColumns
    : itemKeys.map((key) => ({ key }));
  const byKey = new Map<string, DataColumn>();
  sourceColumns.forEach((column) => {
    const key = getString(column, "key");
    if (!key || key === "--") return;
    byKey.set(key, reviewColumn(key, column));
  });
  ["stock_code", "stock_name", "code", "name", "change_pct", "latest_price", "board_count", "lianban_text", "first_limit_time", "final_limit_time", "amount", "amount_yi", "float_market_cap_yi", "reason", "industry"].forEach((key) => {
    if (!byKey.has(key) && items.some((item) => item[key] !== undefined && item[key] !== null && item[key] !== "")) {
      byKey.set(key, reviewColumn(key));
    }
  });
  const preferredOrder = ["stock_code", "stock_name", "code", "name", "change_pct", "latest_price", "board_count", "lianban_text", "first_limit_time", "final_limit_time", "amount", "amount_yi", "float_market_cap_yi", "reason", "industry"];
  const ordered = [
    ...preferredOrder.flatMap((key) => byKey.get(key) ? [byKey.get(key)!] : []),
    ...Array.from(byKey.values()).filter((column) => !preferredOrder.includes(column.key))
  ];
  return ordered.slice(0, 12);
}

function reviewColumn(key: string, raw: Record<string, unknown> = {}): DataColumn {
  const isChange = /change|pct/i.test(key);
  return {
    align: (getString(raw, "align", isNumericReviewKey(key) ? "right" : "left") as "center" | "left" | "right"),
    key,
    label: resolveColumnLabel(key, getOptionalString(raw, "label")),
    tone: isChange ? "change" : "plain",
    variant: isChange ? "change" : key === "stock_code" || key === "stock_name" || key === "code" || key === "name" ? "stock" : "plain",
    width: Number(raw.width) || undefined
  };
}

function formatReviewCell(key: string, value: unknown): string {
  if (key === "change_pct" || key === "turnover_rate" || /_pct$|_rate$/i.test(key)) {
    const text = stringifyCell(value).trim();
    if (!text || text === "--") return "--";
    return text.endsWith("%") ? text : formatPercent(value);
  }
  return stringifyCell(value || value === 0 ? value : "--");
}

function isNumericReviewKey(key: string): boolean {
  return /pct|price|amount|count|cap|rate|rank|time/i.test(key);
}

function reviewGroupMode(group: Record<string, unknown>, items: Record<string, unknown>[]): ReviewGroupMode {
  const name = getString(group, "name", "").trim();
  const lower = name.toLowerCase().replace(/[\s-]+/g, "_");
  if (/first|首板/.test(lower) || /^1\s*板$/.test(name)) {
    return "first";
  }
  const boardNumber = Number((name.match(/^(\d+)\s*板$/) ?? [])[1]);
  if (boardNumber === 1) {
    return "first";
  }
  if (items.length > 0 && items.every((item) => Number(item.board_count ?? item.board ?? 0) === 1)) {
    return "first";
  }
  return "lianban";
}

function reviewGroupSummary(items: Record<string, unknown>[]): string {
  const names = items.slice(0, 2).map((item) => getString(item, "stock_name", getString(item, "name", getString(item, "code", "")))).filter(Boolean);
  return names.join(" / ") || "等待样本";
}

function groupRowCount(groups: ReviewGroupView[]): number {
  return groups.reduce((total, group) => {
    const parsed = Number(group.count);
    return total + (Number.isFinite(parsed) ? parsed : group.rows.length);
  }, 0);
}

function feedbackSectionTitle(section: Record<string, unknown>): string {
  const title = getString(section, "title", "");
  if (title && title !== "--") {
    return columnLabel(title);
  }
  return columnLabel(getString(section, "key", "反馈分组"));
}

function displayReviewGroupName(value: string): string {
  const normalized = value.trim();
  const lower = normalized.toLowerCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    broken_board: "炸板池",
    first: "首板",
    first_board: "首板",
    limit_up: "涨停池",
    limit_up_pool: "涨停池",
    sealed: "封板池",
    zt: "涨停池",
    zb: "炸板池"
  };
  if (labels[lower]) {
    return labels[lower];
  }
  const chineseBoardMatch = normalized.match(/^(\d+)\s*板$/);
  if (chineseBoardMatch) {
    return Number(chineseBoardMatch[1]) === 1 ? "首板" : `${chineseBoardMatch[1]}板`;
  }
  const boardMatch = lower.match(/^(\d+)_?(?:board|boards|ban)$/);
  if (boardMatch) {
    return Number(boardMatch[1]) === 1 ? "首板" : `${boardMatch[1]}板`;
  }
  return columnLabel(normalized);
}

function boardToneClass(boardCount: number): string {
  if (boardCount >= 7) return "tone-super";
  if (boardCount >= 5) return "tone-hot";
  if (boardCount >= 3) return "tone-warm";
  return "tone-cool";
}
