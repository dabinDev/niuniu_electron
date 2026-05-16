import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { asRecord, buildQuery, columnLabel, getRecord, getRecords, getString, recordListToTable, tablesToSheets, toColumns, toRows } from "../../core/api/data";
import { queryKeys } from "../../core/api/queryKeys";
import { useApiClient } from "../../core/api/useApiClient";
import { displayDate } from "../../core/format/date";
import { errorMessage } from "../../core/format/error";
import type { DataColumn, DataRow } from "../../shared/components/DataTable";
import { DataTable } from "../../shared/components/DataTable";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { ExportActions } from "../../shared/components/ExportActions";
import { GlassCard } from "../../shared/components/GlassCard";
import { LoadingState } from "../../shared/components/LoadingState";
import { PageHeader } from "../../shared/components/PageHeader";
import { TradeDateNavigation } from "../../shared/components/TradeDateNavigation";
import { WorkspaceSummaryBar } from "../../shared/components/WorkspaceSummaryBar";
import { yesterdayStatsPath } from "../apiPaths";

type MarketCenterSection = {
  columns: DataColumn[];
  count: string;
  detail: string;
  group: "market" | "short";
  groupLabel: string;
  id: string;
  rows: DataRow[];
  title: string;
};

export function MarketCenterPage() {
  const client = useApiClient();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [tradeDate, setTradeDate] = useState<string | undefined>();
  const [activeSectionId, setActiveSectionId] = useState("");
  const marketQuery = useQuery({
    queryFn: () => client.getMap(`/api/v1/market-center-page${buildQuery({ trade_date: tradeDate })}`),
    queryKey: queryKeys.marketCenter(tradeDate)
  });
  const shortQuery = useQuery({
    queryFn: () => client.getMap(yesterdayStatsPath({ tradeDate, limit: 40 })),
    queryKey: queryKeys.yesterdayStats(tradeDate, "market-center")
  });

  if (marketQuery.isLoading || shortQuery.isLoading) return <LoadingState title="正在加载行情中心" />;
  if (marketQuery.isError) return <ErrorState message={errorMessage(marketQuery.error)} onRetry={() => marketQuery.refetch()} />;
  if (shortQuery.isError) return <ErrorState message={errorMessage(shortQuery.error)} onRetry={() => shortQuery.refetch()} />;
  const data = marketQuery.data;
  const shortData = shortQuery.data;
  if (!data) return <EmptyState action="刷新行情中心" description="行情中心没有拿到任何表格，请确认交易日数据是否已经落库。" title="行情中心暂无数据" tone="market" />;
  const marketCenter = getRecord(data, "market_center");
  const tables = getRecords(marketCenter, "tables");
  const sections = buildMarketCenterSections(tables, shortData ?? {});
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];
  const groupedSections = [
    { count: sections.filter((section) => section.group === "market").length, key: "market", label: "行情表格", sections: sections.filter((section) => section.group === "market") },
    { count: sections.filter((section) => section.group === "short").length, key: "short", label: "空头反馈", sections: sections.filter((section) => section.group === "short") }
  ];
  const exportSheets = [
    ...tablesToSheets(tables),
    ...sections
      .filter((section) => section.group === "short")
      .map((section) => ({
        name: section.title,
        rows: [section.columns.map((column) => column.label), ...section.rows.map((row) => section.columns.map((column) => String(row.values[column.key] ?? "")))]
      }))
  ];

  return (
    <section className="page-scroll" ref={workspaceRef}>
      <PageHeader
        actions={<ExportActions onRefresh={() => { marketQuery.refetch(); shortQuery.refetch(); }} payload={{ ...data, short_side: shortData }} sheets={exportSheets} targetRef={workspaceRef} title="行情中心" />}
        description="把行情表格和空头反馈合并到同一个行情工作台，共用交易日导航，左侧切换数据视角。"
        meta={displayDate(getString(marketCenter, "trade_date", ""))}
        title="行情中心"
      />
      <TradeDateNavigation navigation={asRecord(data.navigation)} onChange={setTradeDate} />
      <section className="market-center-workspace">
        <aside className="market-center-side-tabs" aria-label="行情中心数据分类">
          {groupedSections.map((group) => (
            <section className={`market-center-tab-group group-${group.key}`} key={group.key}>
              <button
                className={activeSection?.group === group.key ? "market-center-group-button on" : "market-center-group-button"}
                onClick={() => setActiveSectionId(group.sections[0]?.id ?? "")}
                type="button"
              >
                <span>{group.label}</span>
                <b>{group.count}</b>
              </button>
              <div>
                {group.sections.map((section) => (
                  <button className={activeSection?.id === section.id ? "on" : ""} key={section.id} onClick={() => setActiveSectionId(section.id)} type="button">
                    <span>{section.title}</span>
                    <small>{section.count} 条</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </aside>
        {activeSection ? (
          <section className="market-center-panel" key={activeSection.id}>
            <WorkspaceSummaryBar
              detail={activeSection.detail}
              items={[
                { label: "数据组", value: activeSection.groupLabel, tone: activeSection.group === "short" ? "down" : "blue" },
                { label: "表格数", value: sections.length, tone: "blue" },
                { label: "当前样本", value: activeSection.rows.length, tone: activeSection.rows.length > 0 ? "up" : "neutral" },
                { label: "交易日", value: displayDate(getString(marketCenter, "trade_date", getString(shortData ?? {}, "trade_date", ""))), tone: "amber" }
              ]}
              title="行情工作台"
            />
            <GlassCard eyebrow={`${activeSection.count} 条`} title={activeSection.title}>
              <div className="section-meta-strip">
                <span>分组 {activeSection.groupLabel}</span>
                <span>字段 {activeSection.columns.length}</span>
                <span>{activeSection.detail}</span>
              </div>
              {activeSection.rows.length === 0 ? (
                <EmptyState action="切换分类或交易日" description="当前分类没有返回记录，保留字段结构方便确认接口状态。" title="当前分类暂无数据" tone="market" />
              ) : (
                <DataTable columns={activeSection.columns} rows={activeSection.rows} />
              )}
            </GlassCard>
          </section>
        ) : (
          <EmptyState action="切换交易日" description="当前交易日没有返回行情或空头反馈数据，保留导航便于快速切换到最近有效日期。" title="行情中心暂无数据" tone="market" />
        )}
      </section>
    </section>
  );
}

function buildMarketCenterSections(tables: Record<string, unknown>[], shortData: Record<string, unknown>): MarketCenterSection[] {
  const marketSections = tables.map((table) => {
    const columns = toColumns(table);
    const rows = toRows(table, columns);
    const title = getString(table, "title", getString(table, "key", "行情表格"));
    return {
      columns,
      count: getString(table, "total", String(rows.length)),
      detail: getString(table, "sort", getString(table, "sort_key", "按接口顺序")),
      group: "market" as const,
      groupLabel: "行情表格",
      id: `market:${getString(table, "key", title)}`,
      rows,
      title
    };
  });
  const shortSections = getRecords(shortData, "sections").map((section) => {
    const table = recordListToTable(getRecords(section, "items"), ["code", "name", "open_change_pct", "change_pct", "amount_yi", "region", "industry"]);
    const rows = table.rows.map((row) => ({
      ...row,
      values: {
        ...row.values,
        change_pct: formatPercentValue(row.values.change_pct),
        open_change_pct: formatPercentValue(row.values.open_change_pct)
      }
    }));
    const title = friendlySectionTitle(section);
    return {
      columns: table.columns,
      count: getString(section, "total", String(rows.length)),
      detail: "亏钱效应 / 修复反馈",
      group: "short" as const,
      groupLabel: "空头反馈",
      id: `short:${getString(section, "key", title)}`,
      rows,
      title
    };
  });
  return [...marketSections, ...shortSections];
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
