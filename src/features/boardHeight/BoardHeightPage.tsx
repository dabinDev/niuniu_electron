import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildQuery, getRecords, getString, recordListToTable } from "../../core/api/data";
import { queryKeys } from "../../core/api/queryKeys";
import { useApiClient } from "../../core/api/useApiClient";
import { displayDate, displayDateTime } from "../../core/format/date";
import { errorMessage } from "../../core/format/error";
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

export function BoardHeightPage() {
  const client = useApiClient();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const matrixScrollRef = useRef<HTMLDivElement | null>(null);
  const columnsScrollRef = useRef<HTMLElement | null>(null);
  const [tradeDate, setTradeDate] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const query = useQuery({
    queryFn: () => client.getMap(`/api/v1/board-height${buildQuery({ trade_date: tradeDate })}`),
    queryKey: queryKeys.boardHeight(tradeDate)
  });
  const data = query.data ?? {};
  const chartItems = getRecords(data, "chart_items");
  const trendItems = normalizeHeightTrendItems(chartItems).slice(-20);
  const visibleDates = new Set(trendItems.map((item) => item.date));
  const columns = getRecords(data, "columns").filter((column) => visibleDates.has(getString(column, "date", ""))).slice(-20);
  const latestTrendItem = trendItems.length > 0 ? trendItems[trendItems.length - 1] : undefined;
  const activeDate = selectedDate && trendItems.some((item) => item.date === selectedDate) ? selectedDate : getString(data, "trade_date", latestTrendItem?.date ?? "");
  const activeColumn = columns.find((column) => getString(column, "date") === activeDate);
  const activeTrendItem = trendItems.find((item) => item.date === activeDate) ?? latestTrendItem;
  const activeStocks = getRecords(activeColumn ?? {}, "stocks");
  const maxBoardCount = useMemo(() => {
    const counts = columns.flatMap((column) => getRecords(column, "stocks").map((stock) => Number(stock.board_count ?? 0))).filter((value) => Number.isFinite(value));
    return Math.max(4, ...counts);
  }, [columns.length]);
  const sheets = columns.map((column) => {
    const table = recordListToTable(getRecords(column, "stocks"), ["code", "name", "board_count"]);
    return { name: getString(column, "date"), rows: [table.columns.map((c) => c.label), ...table.rows.map((r) => table.columns.map((c) => String(r.values[c.key] ?? "")))] };
  });
  const activePreview = activeStocks.slice(0, 8);

  useEffect(() => {
    [matrixScrollRef.current, columnsScrollRef.current].forEach((element) => {
      if (!element) return;
      const left = Math.max(0, element.scrollWidth - element.clientWidth);
      if (typeof element.scrollTo === "function") {
        element.scrollTo({ behavior: "auto", left });
      } else {
        element.scrollLeft = left;
      }
    });
  }, [columns.length, activeDate]);

  if (query.isLoading) return <LoadingState title="正在加载连板高度" />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  if (!query.data) return <EmptyState action="刷新连板高度" description="连板高度接口没有返回曲线和高标列表，请确认复盘任务已完成。" title="连板高度暂无数据" tone="market" />;

  return (
    <section className="page-scroll" ref={workspaceRef}>
      <PageHeader
        actions={<ExportActions onRefresh={() => query.refetch()} payload={data} sheets={sheets} targetRef={workspaceRef} title="连板高度" />}
        description="展示高度折线、每日高标和高标股票列表，沿用旧版日期联动阅读方式。"
        meta={`${displayDate(getString(data, "trade_date", ""))} · ${displayDateTime(getString(data, "fetched_at", ""))}`}
        title="连板高度"
      />
      <TradeDateNavigation navigation={{
        available_trade_dates: data.available_trade_dates as string[] | undefined,
        next_trade_date: getString(data, "next_trade_date", ""),
        previous_trade_date: getString(data, "previous_trade_date", ""),
        resolved_trade_date: getString(data, "trade_date", "")
      }} onChange={setTradeDate} />
      <section className="metric-grid">
        <MetricCard label="最新高度" tone="up" value={`${getString(data, "latest_height", "--")} 板`} />
        <MetricCard label="统计天数" value={`${trendItems.length} 日`} />
        <MetricCard label="前一交易日" value={displayDate(getString(data, "previous_trade_date", ""))} />
        <MetricCard label="后一交易日" value={displayDate(getString(data, "next_trade_date", ""))} />
      </section>
      <section className="content-grid height-workspace-grid">
        <GlassCard className="height-trend-card" title="高度曲线">
          <HeightTrendChart activeDate={activeDate} items={trendItems} onSelectDate={setSelectedDate} />
        </GlassCard>
        <GlassCard className="height-inspector-card" eyebrow={activeDate || "等待选择"} title="锚点详情">
          <div className="height-inspector" data-testid="height-inspector">
            <article className="height-inspector-main">
              <span>当前日期</span>
              <b data-testid="height-active-date">{activeDate || "--"}</b>
              <small>{activeTrendItem ? `${activeTrendItem.value} 板 · ${activeStocks.length} 只高标` : "点击折线日期后联动"}</small>
            </article>
            <div className="height-leader-strip">
              <span>空间龙头</span>
              <b>{activeTrendItem?.leaderName ?? "--"}</b>
              <small>{activeTrendItem?.leaderCode ?? "--"}</small>
            </div>
            <div className="height-preview-chips">
              {activePreview.length === 0 ? <span className="muted-chip">暂无成员</span> : null}
              {activePreview.map((stock) => (
                <button className={boardToneClass(Number(stock.board_count ?? 0), maxBoardCount)} key={`${getString(stock, "code")}-${getString(stock, "name")}`} onClick={() => setSelectedStock(getString(stock, "code", ""))} type="button">
                  <b>{getString(stock, "name")}</b>
                  <span>{getString(stock, "code")}</span>
                </button>
              ))}
            </div>
          </div>
        </GlassCard>
      </section>
      <section className="height-session-matrix">
        <GlassCard className="height-matrix-card" eyebrow="最近 20 日" title="高度矩阵">
          <div className="height-matrix-scroll" ref={matrixScrollRef}>
            <div className="height-matrix-table" style={{ "--height-days": Math.max(columns.length, 1) } as React.CSSProperties}>
              <div className="height-matrix-header-row">
                <div className="height-matrix-tier sticky">梯队</div>
                {columns.map((column) => (
                  <button
                    className={`height-matrix-date ${getString(column, "date") === activeDate ? "selected" : ""}`}
                    key={getString(column, "date")}
                    onClick={() => setSelectedDate(getString(column, "date"))}
                    type="button"
                  >
                    <b>{getString(column, "date")}</b>
                    <span>{getRecords(column, "stocks").length} 只</span>
                  </button>
                ))}
              </div>
              {Array.from({ length: Math.max(1, ...columns.map((column) => getRecords(column, "stocks").length)) }).map((_, rowIndex) => (
                <div className="height-matrix-row" key={`row-${rowIndex}`}>
                  <div className="height-matrix-tier sticky">{rowIndex + 1}</div>
                  {columns.map((column) => {
                    const stock = getRecords(column, "stocks")[rowIndex];
                    const selected = getString(column, "date") === activeDate;
                    return stock ? (
                      <button
                        className={`height-matrix-stock ${selected ? "selected" : ""} ${boardToneClass(Number(stock.board_count ?? 0), maxBoardCount)}`}
                        key={`${getString(column, "date")}-${rowIndex}-${getString(stock, "code")}`}
                        onClick={() => {
                          setSelectedDate(getString(column, "date"));
                          setSelectedStock(getString(stock, "code", ""));
                        }}
                        type="button"
                      >
                        <b>{getString(stock, "name")}</b>
                        <span>{getString(stock, "code")}</span>
                        <small>{getString(stock, "board_count", "--")} 板</small>
                      </button>
                    ) : (
                      <div className={`height-matrix-stock empty ${selected ? "selected" : ""}`} key={`${getString(column, "date")}-${rowIndex}`} />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </section>
      <section className="board-height-columns" ref={columnsScrollRef} style={{ "--height-card-count": Math.max(columns.length, 1) } as React.CSSProperties}>
        {columns.map((column) => {
          const table = recordListToTable(getRecords(column, "stocks"), ["code", "name", "board_count"]);
          return (
            <GlassCard
              className={`height-date-card ${getString(column, "date") === activeDate ? "selected" : ""}`}
              eyebrow={`${table.rows.length} 只高标`}
              key={getString(column, "date")}
              title={getString(column, "date")}
            >
              <div className={getString(column, "date") === activeDate ? "selected" : ""} data-testid={`height-date-card-${getString(column, "date")}`}>
              {table.rows.length === 0 ? (
                <EmptyState description="该日没有高标股票记录。" title="暂无高标" tone="muted" />
              ) : (
                <DataTable columns={table.columns} rows={table.rows.map((row) => ({ ...row, onClick: () => setSelectedStock(String(row.values.code ?? "")) }))} />
              )}
              </div>
            </GlassCard>
          );
        })}
      </section>
      {selectedStock ? <StockProfileSheet onClose={() => setSelectedStock(null)} symbol={selectedStock} /> : null}
    </section>
  );
}

function boardToneClass(boardCount: number, maxBoardCount: number): string {
  if (boardCount <= 3) return "tone-neutral";
  const span = Math.max(1, maxBoardCount - 4);
  const bucket = Math.min(4, Math.max(1, Math.ceil(((boardCount - 3) / span) * 4)));
  return `tone-heat-${bucket}`;
}
