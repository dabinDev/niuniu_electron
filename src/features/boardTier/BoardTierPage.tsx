import { useQuery } from "@tanstack/react-query";
import { type CSSProperties, useRef, useState } from "react";
import { getRecords, getString, recordListToTable } from "../../core/api/data";
import { queryKeys } from "../../core/api/queryKeys";
import { useApiClient } from "../../core/api/useApiClient";
import { displayDate, displayDateTime } from "../../core/format/date";
import { errorMessage } from "../../core/format/error";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { ExportActions } from "../../shared/components/ExportActions";
import { LoadingState } from "../../shared/components/LoadingState";
import { MetricCard } from "../../shared/components/MetricCard";
import { PageHeader } from "../../shared/components/PageHeader";
import { StockProfileSheet } from "../../shared/components/StockProfileSheet";
import { TradeDateNavigation } from "../../shared/components/TradeDateNavigation";
import { boardTierPath } from "../apiPaths";

export function BoardTierPage() {
  const client = useApiClient();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [tradeDate, setTradeDate] = useState<string | undefined>();
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const query = useQuery({
    queryFn: () => client.getMap(boardTierPath({ tradeDate, tierLimit: 12, stockLimit: 40 })),
    queryKey: queryKeys.boardTier(tradeDate)
  });
  const previousTradeDate = getString(query.data ?? {}, "previous_trade_date", "");
  const previousQuery = useQuery({
    enabled: Boolean(previousTradeDate),
    queryFn: () => client.getMap(boardTierPath({ tradeDate: previousTradeDate, tierLimit: 12, stockLimit: 40 })),
    queryKey: queryKeys.boardTier(previousTradeDate)
  });

  if (query.isLoading) return <LoadingState title="正在加载连板天梯" />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  const data = query.data;
  if (!data) return <EmptyState action="刷新连板天梯" description="连板天梯没有返回分层数据，请确认涨停复盘任务已经完成。" title="连板天梯暂无数据" tone="market" />;
  const tiers = getRecords(data, "tiers");
  const sheets = tiers.map((tier) => {
    const table = recordListToTable(getRecords(tier, "stocks"), ["code", "name", "status", "change_pct", "latest_price", "first_limit_time", "amount", "reason"]);
    return { name: getString(tier, "title"), rows: [table.columns.map((c) => c.label), ...table.rows.map((r) => table.columns.map((c) => String(r.values[c.key] ?? "")))] };
  });

  return (
    <section className="page-scroll" ref={workspaceRef}>
      <PageHeader
        actions={<ExportActions onRefresh={() => query.refetch()} payload={data} sheets={sheets} targetRef={workspaceRef} title="连板天梯" />}
        description="按连板高度拆分梯队，展示封板/炸板、成功率、原因和核心交易字段。"
        meta={`${displayDate(getString(data, "trade_date", ""))} · ${displayDateTime(getString(data, "fetched_at", ""))}`}
        title="连板天梯"
      />
      <TradeDateNavigation navigation={{
        available_trade_dates: data.available_trade_dates as string[] | undefined,
        next_trade_date: getString(data, "next_trade_date", ""),
        previous_trade_date: getString(data, "previous_trade_date", ""),
        resolved_trade_date: getString(data, "trade_date", "")
      }} onChange={setTradeDate} />
      <section className="metric-grid">
        <MetricCard label="梯队数" value={getString(data, "total_tiers", "0")} />
        <MetricCard label="股票数" tone="up" value={getString(data, "total_stocks", "0")} />
        <MetricCard label="最高梯队" tone="up" value={tiers[0] ? getString(tiers[0], "title") : "--"} />
        <MetricCard label="交易日" value={displayDate(getString(data, "trade_date", ""))} />
      </section>
      <section data-testid="board-tier-compare">
        <TierTreeCompare
          currentData={data}
          currentLoading={false}
          onSelectStock={setSelectedStock}
          previousData={previousQuery.data}
          previousLoading={previousQuery.isLoading}
        />
      </section>
      {selectedStock ? <StockProfileSheet onClose={() => setSelectedStock(null)} symbol={selectedStock} /> : null}
    </section>
  );
}

function TierTreeCompare({
  currentData,
  currentLoading,
  onSelectStock,
  previousData,
  previousLoading
}: {
  currentData?: Record<string, unknown>;
  currentLoading: boolean;
  onSelectStock: (symbol: string) => void;
  previousData?: Record<string, unknown>;
  previousLoading: boolean;
}) {
  const previousTiers = getRecords(previousData ?? {}, "tiers");
  const currentTiers = getRecords(currentData ?? {}, "tiers");
  const heights = Array.from(new Set([...previousTiers, ...currentTiers].map(tierHeight).filter((height) => height > 0))).sort((a, b) => b - a);
  const previousByHeight = new Map(previousTiers.map((tier) => [tierHeight(tier), tier]));
  const currentByHeight = new Map(currentTiers.map((tier) => [tierHeight(tier), tier]));

  return (
    <div className="tier-tree-workspace" data-testid="board-tier-tree">
      <header className="tier-tree-header">
        <div className="tier-tree-lane previous" data-testid="board-tier-lane-previous">
          <span>上个交易日</span>
          <b>{getString(previousData ?? {}, "trade_date", "--")}</b>
          <small>{getString(previousData ?? {}, "total_stocks", "0")} 只 · {getString(previousData ?? {}, "total_tiers", "0")} 梯队</small>
        </div>
        <div className="tier-tree-trunk">
          <span>树干高度</span>
          <b>连板对标</b>
        </div>
        <div className="tier-tree-lane current" data-testid="board-tier-lane-current">
          <span>当前交易日</span>
          <b>{getString(currentData ?? {}, "trade_date", "--")}</b>
          <small>{getString(currentData ?? {}, "total_stocks", "0")} 只 · {getString(currentData ?? {}, "total_tiers", "0")} 梯队</small>
        </div>
      </header>
      {previousLoading || currentLoading ? <LoadingState title="正在对齐连板天梯" /> : null}
      {!previousLoading && !currentLoading && heights.length === 0 ? (
        <EmptyState description="当前和上个交易日都没有返回连板梯队，可以切换交易日或等待复盘任务补齐。" title="暂无梯队" tone="market" />
      ) : null}
      <div className="tier-tree-rows">
        {heights.map((height, index) => (
          <div className="tier-tree-row" data-testid={`tier-tree-row-${height}`} key={height} style={{ "--tier-delay": `${index * 35}ms` } as CSSProperties}>
            <TierTreeCard onSelectStock={onSelectStock} side="previous" tier={previousByHeight.get(height)} />
            <div className="tier-tree-height-node">
              <i />
              <b>{height}板</b>
              <span>{height >= 5 ? "高标" : height >= 3 ? "中轴" : "低位"}</span>
            </div>
            <TierTreeCard onSelectStock={onSelectStock} side="current" tier={currentByHeight.get(height)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TierTreeCard({ onSelectStock, side, tier }: { onSelectStock: (symbol: string) => void; side: "current" | "previous"; tier?: Record<string, unknown> }) {
  if (!tier) {
    return (
      <article className={`tier-tree-card ${side} empty`}>
        <span>无对应梯队</span>
        <b>--</b>
      </article>
    );
  }
  const stocks = getRecords(tier, "stocks");
  return (
    <article className={`tier-tree-card ${side}`}>
      <header className="tier-tree-card-head">
        <div>
          <span>{side === "previous" ? "昨日树杈" : "今日树杈"}</span>
          <b>{getString(tier, "title")}</b>
        </div>
        <strong>{stocks.length} 只</strong>
      </header>
      <div className="tier-summary-grid">
        <article className="tier-summary-main">
          <span>梯队</span>
          <b>{getString(tier, "title")}</b>
        </article>
        <article>
          <span>封板</span>
          <b>{getString(tier, "sealed_count", "0")}</b>
        </article>
        <article>
          <span>炸板</span>
          <b>{getString(tier, "broken_count", "0")}</b>
        </article>
        <article>
          <span>成功率</span>
          <b>{getString(tier, "success_rate_text", "--")}</b>
        </article>
        <article>
          <span>样本</span>
          <b>{stocks.length}</b>
        </article>
      </div>
      <div className="tier-tree-stock-list">
        {stocks.map((stock) => (
          <button key={`${getString(tier, "title")}-${getString(stock, "code")}`} onDoubleClick={() => onSelectStock(getString(stock, "code"))} type="button">
            <b>{getString(stock, "name", "--")}</b>
            <span>{getString(stock, "code", "--")} · {marketStatusLabel(getString(stock, "status", "--"))} · {getString(stock, "change_pct", "--")}</span>
            <small>{getString(stock, "first_limit_time", "--")} · {getString(stock, "amount", "--")} · {getString(stock, "reason", "--")}</small>
          </button>
        ))}
      </div>
    </article>
  );
}

function tierHeight(tier: Record<string, unknown>): number {
  const title = getString(tier, "title", "");
  const matched = title.match(/\d+/);
  return matched ? Number(matched[0]) : 0;
}

function marketStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    broken: "炸板",
    sealed: "封板"
  };
  return labels[value.toLowerCase()] ?? value;
}
