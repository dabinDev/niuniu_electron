import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { asRecord, getRecords, getString, recordListToTable, tablesToSheets } from "../../core/api/data";
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
import { DataTable } from "../../shared/components/DataTable";
import { AiAnalysisPanel } from "../../shared/components/AiAnalysisPanel";
import { AutoRefreshToggle } from "../../shared/components/AutoRefreshToggle";
import { StockProfileSheet } from "../../shared/components/StockProfileSheet";
import { WorkspaceSummaryBar } from "../../shared/components/WorkspaceSummaryBar";
import { buildAskAiClientConfig, buildAskAiSyncPayload, loadAskAiSettings } from "../askAi/askAiSettings";
import { useAiFeatureUsage } from "../askAi/useAiFeatureUsage";

export function AuctionPage() {
  const client = useApiClient();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [activeRank, setActiveRank] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
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
  const currentRankTable = currentRank
    ? recordListToTable(getRecords(currentRank, "items"), ["code", "name", "bid_change_pct", "current_change_pct", "bid_amount_wan", "board_text", "concept", "action"])
    : { columns: [], rows: [] };
  const currentRankRows = currentRankTable.rows.map((row) => ({
    ...row,
    onClick: () => setSelectedStock(String(row.values.code ?? "")),
    values: {
      ...row.values,
      bid_change_pct: formatPercentValue(row.values.bid_change_pct),
      current_change_pct: formatPercentValue(row.values.current_change_pct)
    }
  }));
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
        description="复刻 Flutter 竞价工作区：历史竞价列、排名表、竞价 AI 分析和导出复制能力都接入真实接口。"
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
              {getRecords(column, "items").slice(0, 9).map((item) => (
                <article className={`tone-${changeTone(getString(item, "zhangfu", "0"))} ${selectedStock === getString(item, "code") ? "selected" : ""}`} key={getString(item, "code")} onClick={() => setSelectedStock(getString(item, "code"))}>
                  <b>{getString(item, "name")}</b>
                  <span>{getString(item, "lianban")} · {formatPercentValue(getString(item, "zhangfu"))}</span>
                  <small>{getString(item, "code")} · {getString(item, "concepts", "")}</small>
                </article>
              ))}
            </div>
          </GlassCard>
        ))}
      </section>

      <section className="content-grid two-one">
        <GlassCard
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
          {currentRankTable.rows.length === 0 ? (
            <EmptyState action="切换排名分组" description="当前排名分组为空，可能是竞价条件没有命中。" hint={getString(currentRank ?? {}, "title", "")} title="排名暂无数据" tone="market" />
          ) : (
            <DataTable columns={currentRankTable.columns} rows={currentRankRows} />
          )}
        </GlassCard>
        <AiAnalysisPanel ai={asRecord(data.ai_analysis)} loading={aiMutation.isPending} onGenerate={() => aiMutation.mutate()} quota={aiUsage.usage} title="竞价 AI 分析" />
      </section>
      {selectedStock ? <StockProfileSheet onClose={() => setSelectedStock(null)} symbol={selectedStock} /> : null}
    </section>
  );
}

function formatPercentValue(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed === "--") return "--";
  return trimmed.endsWith("%") ? trimmed : `${trimmed}%`;
}
