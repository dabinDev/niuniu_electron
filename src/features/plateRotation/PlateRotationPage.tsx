import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
import { LoadingState } from "../../shared/components/LoadingState";
import { MetricCard } from "../../shared/components/MetricCard";
import { PageHeader } from "../../shared/components/PageHeader";
import { StockProfileSheet } from "../../shared/components/StockProfileSheet";
import { TradeDateNavigation } from "../../shared/components/TradeDateNavigation";
import { TrendLineChart } from "../../shared/components/TrendLineChart";
import { WorkspaceSummaryBar } from "../../shared/components/WorkspaceSummaryBar";
import { buildPlateRotationViewModel, resolvePlateSelection, sequenceItemToSelection, sequenceToTrendSeries, type PlateRotationCell, type PlateRotationSelection } from "./plateRotationModel";

export function PlateRotationPage() {
  const client = useApiClient();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [tradeDate, setTradeDate] = useState<string | undefined>();
  const [selectedPlate, setSelectedPlate] = useState<PlateRotationSelection | null>(null);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const query = useQuery({
    queryFn: () => client.getMap(`/api/v1/plate-rotation${buildQuery({ trade_date: tradeDate, limit: 20 })}`),
    queryKey: queryKeys.plateRotation(tradeDate)
  });
  const stocks = useQuery({
    enabled: Boolean(selectedPlate?.code),
    queryFn: () => client.getMap(`/api/v1/plates/${encodeURIComponent(selectedPlate?.code ?? "")}/stocks${buildQuery({ limit: 30 })}`),
    queryKey: ["plate-stocks", selectedPlate?.code]
  });

  if (query.isLoading) return <LoadingState title="正在加载板块轮动" />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  const data = query.data;
  if (!data) return <EmptyState action="刷新板块轮动" description="板块轮动没有返回矩阵数据，请确认板块强度任务是否完成。" title="板块轮动暂无数据" tone="market" />;
  const model = buildPlateRotationViewModel(data);
  const stockItems = stocks.data ? resolvePlateStockItems(stocks.data, selectedPlate?.date) : [];
  const stockKeys = stockItems.some((item) => "stock_code" in item || "stock_name" in item)
    ? ["rank_no", "stock_code", "stock_name"]
    : ["code", "name", "change_pct", "latest_price", "reason"];
  const stockTable = stocks.data ? recordListToTable(stockItems, stockKeys) : { columns: [], rows: [] };
  const leadingPlate = model.sequence[0];
  const resolvedTradeDate = getString(data, "trade_date", "");
  const selectedPlateCode = selectedPlate?.code;
  const handleCellSelect = (cell: PlateRotationCell | null) => {
    const next = resolvePlateSelection(cell);
    if (next) {
      setSelectedPlate(next);
      return;
    }
    setSelectedPlate(null);
  };

  return (
    <section className="page-scroll" ref={workspaceRef}>
      <PageHeader
        actions={<ExportActions onRefresh={() => query.refetch()} payload={data} targetRef={workspaceRef} title="板块轮动" />}
        description="展示板块强度矩阵、轮动序列、日期摘要和板块内股票，帮助判断资金承接方向。"
        meta={`${displayDate(getString(data, "trade_date", ""))} · ${displayDateTime(getString(data, "fetched_at", ""))}`}
        title="板块轮动"
      />
      <TradeDateNavigation navigation={{
        available_trade_dates: data.available_trade_dates as string[] | undefined,
        next_trade_date: getString(data, "next_trade_date", ""),
        previous_trade_date: getString(data, "previous_trade_date", ""),
        resolved_trade_date: getString(data, "trade_date", "")
      }} onChange={setTradeDate} />
      <section className="metric-grid">
        <MetricCard label="轮动板块" value={getString(data, "total", String(model.total))} />
        <MetricCard label="矩阵天数" value={`${model.dates.length} 日`} />
        <MetricCard label="前一交易日" value={displayDate(getString(data, "previous_trade_date", ""))} />
        <MetricCard label="后一交易日" value={displayDate(getString(data, "next_trade_date", ""))} />
      </section>
      <WorkspaceSummaryBar
        detail={selectedPlate ? `${displayDate(selectedPlate.date)} · ${selectedPlate.name} · 排名 ${selectedPlate.rank || "--"}` : "点击矩阵格子查看板块细节"}
        items={[
          { label: "矩阵天数", value: model.dates.length, tone: "blue" },
          { label: "板块样本", value: model.sequence.length, tone: model.sequence.length > 0 ? "up" : "neutral" },
          { label: "当前龙头", value: leadingPlate?.name ?? "--", detail: leadingPlate ? `强度 ${leadingPlate.latestStrengthValue}` : "--", tone: "up" },
          { label: "选中强度", value: selectedPlate ? `强度 ${selectedPlate.strengthValue}` : "--", tone: selectedPlate ? "amber" : "neutral" }
        ]}
        title="板块轮动矩阵"
      />
      <section className="content-grid rotation-priority-grid">
        <GlassCard className="rotation-trend-card" eyebrow="强度序列" title="强度趋势">
          <TrendLineChart series={sequenceToTrendSeries(model.sequence, 5)} />
        </GlassCard>
        <GlassCard className="rotation-near-card" title="近两日强度板块">
          <div className="near-plate-band">
            {model.nearTerm.length === 0 ? <EmptyState description="近两日暂无强度板块。" title="暂无强度样本" tone="muted" /> : null}
            {model.nearTerm.map((cell) => (
              <button className={`near-plate color-${cell.colorIndex} ${selectedPlateCode && selectedPlateCode === cell.resolvedCode ? "same-plate" : ""}`} key={`${cell.date}-${cell.rank}-${cell.name}`} onClick={() => handleCellSelect(cell)} type="button">
                <small>{displayDate(cell.date)} · 排名 {cell.rank}</small>
                <b>{cell.name}</b>
                <span>强度 {cell.strengthValue}</span>
              </button>
            ))}
          </div>
        </GlassCard>
      </section>
      <GlassCard className="rotation-matrix-card" title="排名与日期强度矩阵">
        {model.rankRows.length === 0 ? <EmptyState action="切换交易日" description="当前交易日没有板块强度矩阵。" title="暂无轮动矩阵" tone="market" /> : null}
        {model.rankRows.length > 0 ? (
          <div className="matrix-scroll">
            <div className="rotation-matrix-table" data-testid="rotation-matrix" style={{ "--matrix-days": model.dates.length } as React.CSSProperties}>
              <div className="matrix-header-row">
                <div className="matrix-corner">排名</div>
              {model.dates.map((date) => (
                <div className="matrix-date" key={date}>
                  <b>{displayDate(date)}</b>
                  <small>{date.slice(5)}</small>
                </div>
              ))}
              </div>
              <div className="matrix-body">
              {model.rankRows.map((row) => (
                <div className="matrix-row" key={row.rank}>
                  <div className={`matrix-rank ${row.rank <= 3 ? "hot" : ""}`}>{row.rank}</div>
                  {row.cells.map((cell, index) => (
                    <button
                      className={`matrix-cell ${cell ? `heat-rank-${Math.min(Math.max(cell.rank, 1), 6)} color-${cell.colorIndex}` : "empty"} ${selectedPlateCode && selectedPlateCode === cell?.resolvedCode ? "same-plate" : ""} ${selectedPlateCode && selectedPlateCode === cell?.resolvedCode && selectedPlate?.date === cell?.date ? "selected" : ""}`}
                      disabled={!cell}
                      key={`${row.rank}-${model.dates[index]}`}
                      onClick={() => handleCellSelect(cell)}
                      type="button"
                    >
                      {cell ? (
                        <>
                          <span>{cell.name}</span>
                          <b className="matrix-strength-value">强度 {cell.strengthValue}</b>
                          <i className="matrix-cell-meter" style={{ "--meter": `${Math.max(18, 100 - Math.min(cell.rank, 8) * 9)}%` } as React.CSSProperties} />
                        </>
                      ) : (
                        <em>--</em>
                      )}
                    </button>
                  ))}
                </div>
              ))}
              </div>
            </div>
          </div>
        ) : null}
      </GlassCard>
      <section className="content-grid two-one">
        <GlassCard title="板块序列">
          <div className="rotation-strip rotation-strip-compact">
            {model.sequence.length === 0 ? <EmptyState description="暂无板块序列数据。" title="暂无序列" tone="muted" /> : null}
            {model.sequence.map((item) => (
              <article
                className={`color-${item.colorIndex} ${selectedPlateCode === item.code ? "selected same-plate" : ""}`}
                key={item.code ?? item.name}
                onClick={() => setSelectedPlate(sequenceItemToSelection(item, selectedPlate?.date ?? resolvedTradeDate))}
              >
                <b>{item.name}</b>
                <span>强度 {item.latestStrengthValue}</span>
              </article>
            ))}
          </div>
        </GlassCard>
        <GlassCard className={`plate-stocks-card ${selectedPlate ? `color-${model.sequence.find((item) => item.code === selectedPlate.code)?.colorIndex ?? 0}` : ""}`} eyebrow={selectedPlate ? `${displayDate(selectedPlate.date)} · ${selectedPlate.strength}` : "等待选择"} title={selectedPlate?.name ?? "板块股票"}>
          {stocks.isLoading ? <LoadingState title="正在加载板块股票" /> : null}
          {stockTable.rows.length === 0 ? (
            <EmptyState action="点击左侧板块" description="选中轮动矩阵或板块序列中的有效板块后，这里会加载板块内股票。" title="等待选择板块" tone="market" />
          ) : (
            <DataTable columns={stockTable.columns} rows={stockTable.rows.map((row) => ({ ...row, onClick: () => setSelectedStock(String(row.values.stock_code ?? row.values.code ?? "")) }))} />
          )}
        </GlassCard>
      </section>
      {selectedStock ? <StockProfileSheet onClose={() => setSelectedStock(null)} symbol={selectedStock} /> : null}
    </section>
  );
}

function resolvePlateStockItems(payload: Record<string, unknown>, selectedDate?: string): Record<string, unknown>[] {
  const items = getRecords(payload, "items");
  const groupedItems = items.filter((item) => getRecords(item, "stocks").length > 0);
  if (groupedItems.length === 0) {
    return items;
  }
  const selectedGroup = groupedItems.find((item) => getString(item, "date", "") === selectedDate) ?? groupedItems[groupedItems.length - 1];
  return getRecords(selectedGroup, "stocks");
}
