import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { columnLabel, getRecord, getRecords, getString, recordListToTable } from "../../core/api/data";
import { queryKeys } from "../../core/api/queryKeys";
import { useApiClient } from "../../core/api/useApiClient";
import { displayDate, displayDateTime } from "../../core/format/date";
import { errorMessage } from "../../core/format/error";
import { changeTone } from "../../core/format/market";
import { DataTable } from "../../shared/components/DataTable";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { ExportActions } from "../../shared/components/ExportActions";
import { GlassCard } from "../../shared/components/GlassCard";
import { LoadingState } from "../../shared/components/LoadingState";
import { MetricCard } from "../../shared/components/MetricCard";
import { PageHeader } from "../../shared/components/PageHeader";
import { SegmentedTabs } from "../../shared/components/SegmentedTabs";
import { StockProfileSheet } from "../../shared/components/StockProfileSheet";
import { yesterdayStatsPath } from "../apiPaths";

export function YesterdayStatsPage() {
  const client = useApiClient();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [tradeDate, setTradeDate] = useState<string | undefined>();
  const [activeSection, setActiveSection] = useState("");
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const query = useQuery({
    queryFn: () => client.getMap(yesterdayStatsPath({ tradeDate, limit: 40 })),
    queryKey: queryKeys.yesterdayStats(tradeDate, activeSection)
  });

  if (query.isLoading) return <LoadingState title="正在加载空头数据" />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  const data = query.data;
  if (!data) return <EmptyState action="刷新昨日统计" description="昨日统计没有返回数据，请确认涨停复盘数据已经生成。" title="昨日统计暂无数据" tone="market" />;
  const today = getRecord(data, "today_stats");
  const yesterday = getRecord(data, "yesterday_stats");
  const tradeDates = getRecord(data, "trade_dates");
  const sections = getRecords(data, "sections");
  const current = sections.find((section) => getString(section, "key") === activeSection) ?? sections[0];
  const table = current ? recordListToTable(getRecords(current, "items"), ["code", "name", "open_change_pct", "change_pct", "amount_yi", "region", "industry"]) : { columns: [], rows: [] };
  const formattedRows = table.rows.map((row) => ({
    ...row,
    onDoubleClick: () => setSelectedStock(String(row.values.code ?? "")),
    values: {
      ...row.values,
      change_pct: formatPercentValue(row.values.change_pct),
      open_change_pct: formatPercentValue(row.values.open_change_pct)
    }
  }));
  const sheets = sections.map((section) => {
    const sectionTable = recordListToTable(getRecords(section, "items"), ["code", "name", "open_change_pct", "change_pct", "amount_yi", "region", "industry"]);
    return { name: getString(section, "title"), rows: [sectionTable.columns.map((c) => c.label), ...sectionTable.rows.map((r) => sectionTable.columns.map((c) => String(r.values[c.key] ?? "")))] };
  });

  return (
    <section className="page-scroll" ref={workspaceRef}>
      <PageHeader
        actions={<ExportActions onRefresh={() => query.refetch()} payload={data} sheets={sheets} targetRef={workspaceRef} title="空头数据" />}
        description="统计昨日涨停、连板、炸板、跌停和反馈表现，辅助判断亏钱效应与次日修复强度。"
        meta={`${displayDate(getString(data, "trade_date", ""))} · ${displayDateTime(getString(data, "fetched_at", ""))}`}
        title="空头数据"
      />
      <div className="trade-date-nav">
        <input type="date" value={tradeDate ?? getString(tradeDates, "current", "")} onChange={(event) => setTradeDate(event.target.value)} />
      </div>
      <section className="metric-grid">
        <MetricCard label="今日涨停" tone="up" value={getString(today, "zt", "0")} />
        <MetricCard label="今日连板" tone="up" value={getString(today, "lb", "0")} />
        <MetricCard label="今日炸板" tone="down" value={getString(today, "zb", "0")} />
        <MetricCard label="昨日跌停" tone="down" value={getString(yesterday, "dt", "0")} />
      </section>
      <section className="yesterday-stats-workspace">
        <aside className="yesterday-stats-tabs">
          <SegmentedTabs
            activeKey={getString(current ?? {}, "key")}
            items={sections.map((section) => ({
              count: getString(section, "total", ""),
              key: getString(section, "key"),
              label: friendlySectionTitle(section),
              tone: changeTone(getString(section, "total", "0"))
            }))}
            onChange={setActiveSection}
          />
        </aside>
        <GlassCard title={friendlySectionTitle(current ?? {}) || getString(current ?? {}, "title", "反馈列表")}>
          {table.rows.length === 0 ? (
            <EmptyState action="切换反馈分类" description="当前分类没有命中股票，可能是这个交易日该风险/修复方向较弱。" hint={friendlySectionTitle(current ?? {})} title="分类暂无样本" tone="market" />
          ) : (
            <DataTable columns={table.columns} rows={formattedRows} />
          )}
        </GlassCard>
      </section>
      {selectedStock ? <StockProfileSheet onClose={() => setSelectedStock(null)} symbol={selectedStock} /> : null}
    </section>
  );
}

function formatPercentValue(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text || text === "--") return "--";
  return text.endsWith("%") ? text : `${text}%`;
}

function friendlySectionTitle(section: Record<string, unknown>): string {
  const title = getString(section, "title", "");
  if (title && title !== "--") {
    const labels: Record<string, string> = {
      today_broken_board: "今日炸板",
      today_limit_down: "今日跌停",
      yesterday_broken_board: "昨日炸板反馈",
      yesterday_limit_down: "昨日跌停反馈"
    };
    return labels[title] ?? columnLabel(title);
  }
  const key = getString(section, "key", "");
  const labels: Record<string, string> = {
    broken: "炸板反馈",
    continued: "连板延续",
    failed: "弱势失败",
    limit_down: "跌停风险",
    repaired: "修复反包",
    today_broken_board: "今日炸板",
    today_limit_down: "今日跌停",
    weak: "弱势样本",
    yesterday_broken_board: "昨日炸板反馈",
    yesterday_limit_down: "昨日跌停反馈",
    zt: "昨日涨停"
  };
  return labels[key] ?? columnLabel(key);
}
