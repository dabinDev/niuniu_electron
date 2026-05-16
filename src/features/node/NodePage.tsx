import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { buildQuery, getRecord, getRecords, getString, recordListToTable } from "../../core/api/data";
import { queryKeys } from "../../core/api/queryKeys";
import { useApiClient } from "../../core/api/useApiClient";
import { displayDate, displayDateTime } from "../../core/format/date";
import { errorMessage } from "../../core/format/error";
import { formatLimitUpCountLabel } from "../../core/format/market";
import { DataTable } from "../../shared/components/DataTable";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { ExportActions } from "../../shared/components/ExportActions";
import { GlassCard } from "../../shared/components/GlassCard";
import { KlineChart } from "../../shared/components/KlineChart";
import { LoadingState } from "../../shared/components/LoadingState";
import { MetricCard } from "../../shared/components/MetricCard";
import { PageHeader } from "../../shared/components/PageHeader";
import { StockProfileSheet } from "../../shared/components/StockProfileSheet";
import { buildRepeatedPlateTags, normalizeNodeDateItems, resolveSelectedNodeDate, resolveSelectedNodePlate } from "./nodeViewModel";

export function NodePage() {
  const client = useApiClient();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [symbolDraft, setSymbolDraft] = useState("sz399001");
  const [symbol, setSymbol] = useState("sz399001");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [plate, setPlate] = useState<{ code: string; date: string; name: string } | null>(null);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const query = useQuery({
    queryFn: () => client.getMap(`/api/v1/node/snapshot${buildQuery({ symbol, days: 60, plate_limit: 8 })}`),
    queryKey: queryKeys.node(symbol, 60)
  });
  const data = query.data ?? {};
  const dateItems = useMemo(() => normalizeNodeDateItems(data), [data]);
  const recentDateItems = useMemo(() => dateItems.slice(-21), [dateItems]);
  const newestDateItems = useMemo(() => [...recentDateItems].reverse(), [recentDateItems]);
  const repeatedTags = useMemo(() => buildRepeatedPlateTags(dateItems), [dateItems]);
  const activeDate = resolveSelectedNodeDate(dateItems, selectedDate, getString(data, "default_date", ""));
  const activeDateItem = dateItems.find((item) => item.date === activeDate);
  const activePlate = resolveSelectedNodePlate(activeDateItem, plate?.date === activeDate ? plate.code : undefined);
  const leaders = useQuery({
    enabled: query.isSuccess && Boolean(activePlate?.code && activeDate),
    queryFn: () => client.getMap(`/api/v1/node/plates/${encodeURIComponent(activePlate?.code ?? "")}/leaders${buildQuery({ date: activeDate, stock_limit: 20 })}`),
    queryKey: ["node-leaders", activePlate?.code, activeDate]
  });

  if (query.isLoading) return <LoadingState title="正在加载牛牛节点" />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  if (!query.data) return <EmptyState action="查询默认指数" description="节点快照没有返回数据，可以先用 sz399001 检查指数 K 线是否可用。" title="节点暂无数据" tone="market" />;
  const quote = getRecord(data, "quote");
  const kline = getRecord(data, "kline");
  const tagToneByName = new Map(repeatedTags.map((tag) => [tag.name, tag.tone]));
  const chartMarkers = dateItems.slice(-21).flatMap((item) =>
    item.topPlates.slice(0, 2).map((plateItem) => ({
      date: getString(item, "date"),
      label: getString(plateItem, "plate_name", "--"),
      tone: tagToneByName.get(getString(plateItem, "plate_name", "")) === "hot" ? "hot" as const : tagToneByName.get(getString(plateItem, "plate_name", "")) === "warm" ? "info" as const : "risk" as const
    }))
  );
  const leaderTable = leaders.data ? recordListToTable(getRecords(leaders.data, "leaders"), ["rank_no", "stock_code", "stock_name"]) : { columns: [], rows: [] };
  const leaderEmptyState = activePlate
    ? {
        action: "切换日期或板块",
        description: `${activeDate || "--"} · ${activePlate.name} 暂未返回龙头股列表，可以切换相邻日期或等待数据源补齐。`,
        title: "当前板块暂无龙头样本"
      }
    : {
        action: "选择 K 线下方板块",
        description: "点击左侧某个交易日的板块节点后，会在这里加载当日龙头股列表。",
        title: "等待选择板块节点"
      };
  const selectDate = (date: string) => {
    const item = dateItems.find((entry) => entry.date === date);
    const firstPlate = item?.topPlates[0];
    setSelectedDate(date);
    setPlate(firstPlate ? { code: getString(firstPlate, "plate_code"), date, name: getString(firstPlate, "plate_name") } : null);
  };
  const runSymbolQuery = () => {
    const nextSymbol = symbolDraft.trim();
    if (!nextSymbol || nextSymbol === symbol) {
      void query.refetch();
      return;
    }
    setSelectedDate("");
    setPlate(null);
    setSymbol(nextSymbol);
  };

  return (
    <section className="page-scroll" ref={workspaceRef}>
      <PageHeader
        actions={<ExportActions onRefresh={() => query.refetch()} payload={data} targetRef={workspaceRef} title="牛牛节点" />}
        description="点击 K 线日期里的板块节点，查看指数、板块强度和龙头股票之间的联动关系。"
        meta={`${displayDate(getString(data, "trade_date", ""))} · ${displayDateTime(getString(data, "fetched_at", ""))}`}
        title="牛牛节点"
      />
      <div className="trade-date-nav">
        <input value={symbolDraft} onChange={(event) => setSymbolDraft(event.target.value)} placeholder="指数或股票代码" />
        <button className="ghost-button" onClick={runSymbolQuery} type="button">查询</button>
      </div>
      <section className="metric-grid">
        <MetricCard label="名称" value={getString(quote, "name", symbol)} />
        <MetricCard label="最新价" value={getString(quote, "price", "--")} />
        <MetricCard label="涨跌幅" value={`${getString(quote, "change_pct", "--")}%`} />
        <MetricCard label="K线数量" value={getString(kline, "total", "0")} />
      </section>
      <section className="node-top-band">
        <GlassCard
          actions={<span className="node-frequency-head-note">按出现次数排序，颜色越强表示近期重复越密集</span>}
          className="node-frequency-card"
          title="21 日重复板块"
        >
          <div className="node-frequency-panel">
            <div className="node-frequency-tags">
              {repeatedTags.length === 0 ? <span className="node-frequency-empty">暂无重复板块</span> : null}
              {repeatedTags.map((tag) => (
                <button
                  className={`node-frequency-tag tone-${tag.tone}`}
                  key={`${tag.code}-${tag.name}`}
                  onClick={() => {
                    const date = [...dateItems].reverse().find((item) =>
                      item.topPlates.some((plateItem) => getString(plateItem, "plate_name", "") === tag.name || getString(plateItem, "plate_code", "") === tag.code)
                    )?.date;
                    if (!date) return;
                    setSelectedDate(date);
                    setPlate({ code: tag.code, date, name: tag.name });
                  }}
                  type="button"
                >
                  <strong>{tag.name}</strong>
                  <span>出现 {tag.count} 次</span>
                </button>
              ))}
            </div>
          </div>
        </GlassCard>
        <GlassCard className="node-leader-card" eyebrow={activeDate || "请选择节点"} title={activePlate?.name ?? "板块龙头"}>
          <div data-testid="node-leader-panel">
          {leaders.isLoading ? (
            <LoadingState title="正在加载龙头" />
          ) : leaders.isError ? (
            <ErrorState message={errorMessage(leaders.error)} onRetry={() => leaders.refetch()} />
          ) : leaderTable.rows.length === 0 ? (
            <EmptyState action={leaderEmptyState.action} description={leaderEmptyState.description} title={leaderEmptyState.title} tone="market" />
          ) : (
            <DataTable columns={leaderTable.columns} rows={leaderTable.rows.map((row) => ({ ...row, onClick: () => setSelectedStock(String(row.values.stock_code ?? "")) }))} />
          )}
          </div>
        </GlassCard>
      </section>
      <section className="node-kline-workspace">
        <GlassCard className="kline-card" title="K 线节点">
          <div className="node-date-strip" aria-label="节点日期选择">
            {newestDateItems.map((item) => (
              <button
                className={item.date === activeDate ? "selected" : ""}
                key={item.date}
                onClick={() => selectDate(item.date)}
                type="button"
              >
                <b>{item.date.slice(5)}</b>
                <span>{item.topPlates[0] ? getString(item.topPlates[0], "plate_name", "--") : "无板块"}</span>
              </button>
            ))}
          </div>
          <KlineChart bars={getRecords(kline, "bars")} markers={chartMarkers} maxBars={21} onSelectDate={selectDate} />
          <div className="node-date-list">
            {newestDateItems.map((item) => (
              <article
                className={item.date === activeDate ? "selected" : ""}
                key={item.date}
              >
                <b>{item.date.slice(5)}</b>
                <div>
                  {item.topPlates.map((plateItem) => {
                    const plateCode = getString(plateItem, "plate_code");
                    const selected = activePlate?.code === plateCode && activeDate === item.date;
                    const tone = tagToneByName.get(getString(plateItem, "plate_name", "")) ?? "cool";
                    return (
                    <button
                      aria-label={`选择 ${item.date} ${getString(plateItem, "plate_name")}`}
                      className={`${selected ? "selected" : ""} tone-${tone}`}
                      key={`${item.date}-${plateCode}`}
                      onClick={() => {
                        setSelectedDate(item.date);
                        setPlate({ code: plateCode, date: item.date, name: getString(plateItem, "plate_name") });
                      }}
                      type="button"
                    >
                      <strong>{getString(plateItem, "plate_name")}</strong>
                      <span className="node-plate-metrics">
                        <em>强度 {nodeStrengthLabel(plateItem)}</em>
                        <em>涨停 {nodeLimitUpLabel(plateItem)}</em>
                      </span>
                    </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </GlassCard>
      </section>
      {selectedStock ? <StockProfileSheet onClose={() => setSelectedStock(null)} symbol={selectedStock} /> : null}
    </section>
  );
}

function nodeStrengthLabel(plateItem: Record<string, unknown>): string {
  const raw = getString(plateItem, "strength", getString(plateItem, "strength_text", "--"));
  return raw.replace(/^[+]/, "").replace(/%$/, "");
}

function nodeLimitUpLabel(plateItem: Record<string, unknown>): string {
  return formatLimitUpCountLabel(plateItem.zt_count);
}
