import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { asArray, asRecord, getRecords, getString, recordListToTable, tablesToSheets } from "../../core/api/data";
import { queryKeys } from "../../core/api/queryKeys";
import { useApiClient } from "../../core/api/useApiClient";
import { displayDate, displayDateTime } from "../../core/format/date";
import { errorMessage } from "../../core/format/error";
import { changeTone } from "../../core/format/market";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { ExportActions } from "../../shared/components/ExportActions";
import { GlassCard } from "../../shared/components/GlassCard";
import { LoadingState } from "../../shared/components/LoadingState";
import { PageHeader } from "../../shared/components/PageHeader";
import { SegmentedTabs } from "../../shared/components/SegmentedTabs";
import { AiAnalysisPanel } from "../../shared/components/AiAnalysisPanel";
import { AutoRefreshToggle } from "../../shared/components/AutoRefreshToggle";
import { StockProfileSheet } from "../../shared/components/StockProfileSheet";
import { WorkspaceSummaryBar } from "../../shared/components/WorkspaceSummaryBar";
import { buildAskAiClientConfig, buildAskAiSyncPayload, loadAskAiSettings } from "../askAi/askAiSettings";
import { useAiFeatureUsage } from "../askAi/useAiFeatureUsage";

const AUCTION_RANK_DISPLAY_KEYS = ["code", "name", "bid_change_pct", "current_change_pct", "bid_amount_wan", "board_text", "concept"];

export function AuctionPage() {
  const client = useApiClient();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [activeRank, setActiveRank] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [profileStock, setProfileStock] = useState<string | null>(null);
  const aiUsage = useAiFeatureUsage("auction");
  const query = useQuery({
    queryFn: () => client.getMap("/api/v1/auction/page?days=5&stock_limit=24&rank_limit=80"),
    queryKey: queryKeys.auction(5, 24, 80)
  });
  const aiMutation = useMutation({
    mutationFn: async () => {
      const settings = loadAskAiSettings();
      if (settings.apiKey) {
        await client.postMap("/api/v1/ask-ai/client-config", buildAskAiSyncPayload(settings, aiUsage.clientId), 12_000);
      }
      return client.postMap("/api/v1/auction/ai-analysis", {
        client_config: buildAskAiClientConfig(settings, aiUsage.clientId)
      }, 240_000);
    },
    onSuccess: () => {
      void query.refetch();
      void aiUsage.query.refetch();
    }
  });

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      query.refetch();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, query]);

  if (query.isLoading) {
    return <LoadingState title="正在加载竞价数据" />;
  }
  if (query.isError) {
    return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  }
  const data = query.data;
  if (!data) {
    return <EmptyState action="刷新竞价接口" description="竞价页没有返回历史列或排名数据，请确认开盘竞价任务已经执行。" title="竞价暂无数据" tone="market" />;
  }
  const historyColumns = getRecords(data, "history_columns");
  const rankSections = getRecords(data, "rank_sections");
  const currentRank = rankSections.find((section) => getString(section, "key") === activeRank) ?? rankSections[0];
  const currentRankItems = currentRank ? getRecords(currentRank, "items") : [];
  const currentRankTable = currentRank
    ? recordListToTable(currentRankItems, AUCTION_RANK_DISPLAY_KEYS)
    : { columns: [], rows: [] };
  const rankTotal = rankSections.reduce((sum, section) => sum + getRecords(section, "items").length, 0);
  const liveColumn = historyColumns[0];
  const sheets = tablesToSheets(
    rankSections.map((section) => ({
      ...section,
      title: getString(section, "title"),
      column_defs: currentRankTable.columns
    }))
  );

  return (
    <section className="page-scroll" ref={workspaceRef}>
      <PageHeader
        actions={
          <>
            <AutoRefreshToggle enabled={autoRefresh} intervalLabel="5秒" onChange={setAutoRefresh} />
            <ExportActions onRefresh={() => query.refetch()} payload={data} sheets={sheets} targetRef={workspaceRef} title="牛牛竞价" />
          </>
        }
        description="按短线开盘节奏组织历史竞价列、排名表、策略辅助分析和导出复制能力。"
        meta={`${displayDate(getString(data, "trade_date", ""))} · ${displayDateTime(getString(data, "fetched_at", ""))}`}
        title="牛牛竞价"
      />

      <WorkspaceSummaryBar
        detail={selectedStock ? `已选中 ${selectedStock}` : "开盘竞价 5 日观察"}
        items={[
          { label: "历史列", value: historyColumns.length, tone: "blue" },
          { label: "排名分组", value: rankSections.length, tone: "amber" },
          { label: "入选样本", value: rankTotal, tone: rankTotal > 0 ? "up" : "neutral" },
          { label: "当前最强", value: getString(liveColumn ?? {}, "title", "--"), detail: `一字 ${getString(liveColumn ?? {}, "yizi_count", "0")}`, tone: "up" }
        ]}
        title="竞价工作台摘要"
      />

      <section className="auction-columns">
        {historyColumns.map((column, index) => (
          <GlassCard className={index === 0 ? "live-column" : ""} eyebrow={getString(column, "trade_label", "竞价")} key={`${getString(column, "trade_date")}-${index}`} title={getString(column, "title", displayDate(getString(column, "trade_date", "")))}>
            <div className="auction-column-meta">
              <span>一字：{getString(column, "yizi_count", "0")}</span>
              <span>封单：{getString(column, "seal_amount", "--")}</span>
              <span>总数：{getString(column, "total", "0")}</span>
            </div>
            <div className="auction-stock-list">
              {getRecords(column, "items").slice(0, 9).map((item) => {
                const code = getString(item, "code");
                const isSameStock = Boolean(selectedStock && selectedStock === code);
                return (
                  <article className={`tone-${changeTone(getString(item, "zhangfu", "0"))} ${isSameStock ? "selected same-stock" : ""}`} data-stock-code={code} key={code} onClick={() => setSelectedStock(code)} onDoubleClick={() => setProfileStock(code)}>
                    {isSameStock ? <span className="auction-same-stock-badge">同股</span> : null}
                    <b>{getString(item, "name")}</b>
                    <span className="auction-stock-change">{getString(item, "lianban")} · {formatPercentValue(getString(item, "zhangfu"))}</span>
                    <AuctionAmountTimeline item={item} timeLabels={asArray(column.time_labels)} />
                    <small>{code} · {formatConcepts(item.concepts)}</small>
                  </article>
                );
              })}
            </div>
          </GlassCard>
        ))}
      </section>

      <section className="content-grid two-one auction-rank-workbench">
        <GlassCard
          className="auction-rank-card"
          actions={
            rankSections.length > 0 ? (
              <SegmentedTabs
                activeKey={getString(currentRank ?? {}, "key")}
                items={rankSections.map((section) => ({ count: getString(section, "total", getString(section, "count", "")), key: getString(section, "key"), label: getString(section, "tab_label", getString(section, "title")), tone: "up" }))}
                onChange={setActiveRank}
              />
            ) : null
          }
          title={getString(currentRank ?? {}, "title", "竞价排名")}
        >
          {currentRankItems.length === 0 ? (
            <EmptyState action="切换排名分组" description="当前排名分组为空，可能是竞价条件没有命中。" hint={getString(currentRank ?? {}, "title", "")} title="排名暂无数据" tone="market" />
          ) : (
            <AuctionRankList items={currentRankItems} onOpenProfile={setProfileStock} onSelect={setSelectedStock} selectedStock={selectedStock} />
          )}
        </GlassCard>
        <AiAnalysisPanel ai={asRecord(data.ai_analysis)} loading={aiMutation.isPending} onGenerate={() => aiMutation.mutate()} quota={aiUsage.usage} title="竞价策略辅助" />
      </section>
      {profileStock ? <StockProfileSheet onClose={() => setProfileStock(null)} symbol={profileStock} /> : null}
    </section>
  );
}

function AuctionAmountTimeline({ item, timeLabels }: { item: Record<string, unknown>; timeLabels: unknown[] }) {
  const amounts = getAuctionAmountPoints(item, timeLabels);
  if (amounts.length === 0) {
    return null;
  }
  return (
    <div className="auction-amount-timeline" aria-label="9点15 9点20 9点25竞价金额对比">
      {amounts.map((point) => (
        <span className={`auction-amount-point ${point.tone ? `trend-${point.tone}` : ""}`} key={point.label}>
          <em>{point.label}</em>
          <b>{point.value}</b>
        </span>
      ))}
    </div>
  );
}

function AuctionRankList({ items, onOpenProfile, onSelect, selectedStock }: { items: Record<string, unknown>[]; onOpenProfile: (code: string) => void; onSelect: (code: string) => void; selectedStock: string | null }) {
  return (
    <div className="auction-rank-list" role="list">
      {items.map((item, index) => {
        const code = getString(item, "code", "--");
        const name = getString(item, "name", "--");
        const bidChange = formatPercentValue(item.bid_change_pct);
        const currentChange = formatPercentValue(item.current_change_pct);
        const bidTone = changeTone(bidChange);
        const currentTone = changeTone(currentChange);
        return (
          <button className={`auction-rank-row tone-${bidTone} ${selectedStock === code ? "selected" : ""}`} key={`${code}-${index}`} onClick={() => onSelect(code)} onDoubleClick={() => onOpenProfile(code)} role="listitem" type="button">
            <span className={`auction-rank-no ${index < 3 ? "top" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
            <span className="auction-rank-main">
              <strong>{name}</strong>
              <em>{code}</em>
            </span>
            <span className={`auction-rank-pill trend-${bidTone}`}>
              <small>竞价</small>
              <b>{bidChange}</b>
            </span>
            <span className={`auction-rank-pill trend-${currentTone}`}>
              <small>当前</small>
              <b>{currentChange}</b>
            </span>
            <span className="auction-rank-amount">
              <small>竞价额</small>
              <b>{formatWanValue(item.bid_amount_wan)}</b>
            </span>
            <span className="auction-rank-board">{cleanDisplayText(getString(item, "board_text", "--"))}</span>
            <span className="auction-rank-concept">{cleanDisplayText(getString(item, "concept", "--"))}</span>
          </button>
        );
      })}
    </div>
  );
}

function getAuctionAmountPoints(item: Record<string, unknown>, timeLabels: unknown[]): { label: string; value: string; tone?: string }[] {
  const rawAmounts = Array.isArray(item.amounts) ? item.amounts : [];
  const labelOrder = ["9:15", "9:20", "9:25"];
  const labelledAmounts = new Map(
    rawAmounts
      .map((raw) => parseAmountPoint(raw))
      .filter((point): point is { label: string; value: string } => Boolean(point))
      .filter((point) => labelOrder.includes(point.label))
      .map((point) => [point.label, point.value])
  );
  const labels = timeLabels.map((label) => String(label));
  const valuesByLabel = new Map<string, string>(labelledAmounts);
  if (valuesByLabel.size === 0) {
    rawAmounts.forEach((raw, index) => {
      const label = labels[index] ?? labelOrder[index] ?? "";
      if (labelOrder.includes(label)) {
        const value = cleanDisplayText(String(raw ?? "").replace(/\byi\b/gi, "亿").replace(/\bwan\b/gi, "万"));
        if (value !== "--") {
          valuesByLabel.set(label, value);
        }
      }
    });
  }
  const zhangfu = formatPercentValue(item.zhangfu);
  if (valuesByLabel.size === 0 && zhangfu === "--") {
    return [];
  }
  const amountPoints = labelOrder.map((label) => ({ label, value: valuesByLabel.get(label) ?? "--" }));
  const trendPoint = { label: "涨幅", value: zhangfu, tone: changeTone(zhangfu) };
  return [...amountPoints, trendPoint];
}

function parseAmountPoint(value: unknown): { label: string; value: string } | null {
  const normalized = cleanDisplayText(String(value ?? "").replace(/\byi\b/gi, "亿").replace(/\bwan\b/gi, "万"));
  const match = normalized.match(/^(9:(?:15|20|25))\s*(.+)$/);
  if (!match) {
    return null;
  }
  return { label: match[1], value: match[2].trim() || "--" };
}

function formatPercentValue(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed === "--") return "--";
  return trimmed.endsWith("%") ? trimmed : `${trimmed}%`;
}

function formatWanValue(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed === "--") return "--";
  if (/万|亿|元/i.test(trimmed)) return trimmed;
  const parsed = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return trimmed;
  if (Math.abs(parsed) >= 10000) {
    return `${formatNumber(parsed / 10000)}亿`;
  }
  return `${formatNumber(parsed)}万`;
}

function formatConcepts(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => cleanDisplayText(String(item ?? ""))).filter((item) => item !== "--").join(" / ") || "--";
  }
  return cleanDisplayText(String(value ?? ""));
}

function formatNumber(value: number): string {
  return value.toLocaleString("zh-CN", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0
  });
}

function cleanDisplayText(value: string): string {
  const trimmed = value.trim();
  return trimmed && trimmed !== "null" && trimmed !== "None" ? trimmed : "--";
}
