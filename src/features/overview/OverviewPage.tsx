import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { asRecord, getRecord, getRecords, getString, tablesToSheets } from "../../core/api/data";
import { queryKeys } from "../../core/api/queryKeys";
import { useApiClient } from "../../core/api/useApiClient";
import { displayDate, displayDateTime } from "../../core/format/date";
import { errorMessage } from "../../core/format/error";
import { changeTone } from "../../core/format/market";
import { formatNumber, toNumber } from "../../core/format/number";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { ExportActions } from "../../shared/components/ExportActions";
import { GlassCard } from "../../shared/components/GlassCard";
import { LoadingState } from "../../shared/components/LoadingState";
import { MetricCard } from "../../shared/components/MetricCard";
import { PageHeader } from "../../shared/components/PageHeader";
import { TrendLineChart } from "../../shared/components/TrendLineChart";
import { buildPlateRotationViewModel, sequenceToTrendSeries, type PlateRotationSequenceItem } from "../plateRotation/plateRotationModel";

export function OverviewPage() {
  const client = useApiClient();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const query = useQuery({
    queryFn: () => client.getMap("/api/v1/overview"),
    queryKey: queryKeys.overview
  });

  if (query.isLoading) {
    return <LoadingState title="正在加载总览" />;
  }
  if (query.isError) {
    return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  }
  const data = query.data;
  if (!data) {
    return <EmptyState action="刷新总览接口" description="总览没有拿到快照数据，先确认后端服务和交易日数据是否已经生成。" title="总览暂无数据" tone="market" />;
  }

  const amount = getRecord(data, "amount_summary");
  const breadth = getRecord(data, "breadth_summary");
  const sentiment = getRecord(data, "sentiment");
  const shell = getRecord(data, "shell_status");
  const jobHealth = getRecord(shell, "job_health");
  const notices = getRecords(data, "notices");
  const indices = getRecords(data, "indices");
  const flatRatio = Math.max(0, 100 - Number(breadth.up_ratio ?? 0) - Number(breadth.down_ratio ?? 0));
  const plateRotation = getRecord(data, "plate_rotation");
  const rotationViewModel = buildPlateRotationViewModel(plateRotation);
  const rotationSequence: PlateRotationSequenceItem[] = rotationViewModel.sequence;
  const rotationTables = getRecords(plateRotation, "matrix_columns").map((column) => ({
    key: getString(column, "date"),
    title: getString(column, "date"),
    items: getRecords(column, "items"),
    column_defs: [
      { key: "rank", label: "排名", align: "center" },
      { key: "plate_name", label: "板块" },
      { key: "zt_count", label: "涨停", align: "right" },
      { key: "strength_text", label: "强度", align: "right" }
    ],
    total: getRecords(column, "items").length
  }));

  return (
    <section className="page-scroll" ref={workspaceRef}>
      <PageHeader
        actions={<ExportActions onRefresh={() => query.refetch()} payload={data} sheets={tablesToSheets(rotationTables)} targetRef={workspaceRef} title="总览" />}
        description="把市场温度、量能、涨跌家数、板块轮动和任务健康聚合在一个开盘工作台里。"
        meta={`${displayDate(getString(data, "trade_date", ""))} · ${displayDateTime(getString(data, "generated_at", ""))}`}
        title="总览"
      />

      <section className="metric-grid">
        <MetricCard delay={0} label="总成交额" value={`${formatNumber(amount.total_amount_yi ?? data.total_amount_yi)} 亿`} delta={`预测 ${formatNumber(amount.predicted_amount_yi ?? data.predicted_amount_yi)} 亿`} />
        <MetricCard delay={70} label="上涨家数" tone="up" value={formatNumber(breadth.up_count ?? data.up_count, 0)} delta={`占比 ${formatNumber(breadth.up_ratio)}%`} />
        <MetricCard delay={140} label="下跌家数" tone="down" value={formatNumber(breadth.down_count ?? data.down_count, 0)} delta={`占比 ${formatNumber(breadth.down_ratio)}%`} />
        <MetricCard delay={210} label="情绪分" tone={changeTone(sentiment.score)} value={formatNumber(sentiment.score, 0)} delta={getString(sentiment, "stage", "市场阶段")} />
      </section>

      <section className="content-grid two-one">
        <GlassCard className="overview-market" eyebrow="指数" title="指数与量能">
          <div className="index-cockpit">
            {indices.map((item, index) => {
              const changeValue = item.change_pct ?? item.change ?? item.change_value;
              const tone = changeTone(changeValue);
              const changeText = formatIndexChange(changeValue);
              const indexMeta = indexDisplayMeta(item);
              return (
                <article className={`index-market-card tone-${tone}`} key={getString(item, "code", String(index))}>
                  <div className="index-card-top">
                    <span className="index-code">{indexMeta.code}</span>
                    <span className="index-market">{indexMeta.market}</span>
                  </div>
                  <div className="index-card-main">
                    <div>
                      <small>{indexMeta.name}</small>
                      <strong>{getString(item, "display_value", formatNumber(item.value))}</strong>
                    </div>
                    <em className="index-change-pill">{changeText}</em>
                  </div>
                  <div className="index-spark-bars" aria-hidden="true">
                    {indexSparkBars(item, index).map((height, barIndex) => (
                      <i key={`${getString(item, "code", String(index))}-${barIndex}`} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="breadth-labels">
            <span className="text-up">上涨 {formatNumber(breadth.up_ratio)}%</span>
            <span>平盘 {formatNumber(flatRatio)}%</span>
            <span className="text-down">下跌 {formatNumber(breadth.down_ratio)}%</span>
          </div>
          <div className="breadth-bar">
            <i className="up" style={{ width: `${Number(breadth.up_ratio ?? 0)}%` }} />
            <i className="flat" style={{ width: `${flatRatio}%` }} />
            <i className="down" style={{ width: `${Number(breadth.down_ratio ?? 0)}%` }} />
          </div>
        </GlassCard>

        <GlassCard eyebrow="运行状态" title="系统状态">
          <div className="status-list">
            <span>市场阶段：{getString(shell, "market_phase", "--")}</span>
            <span>数据新鲜度：{getString(shell, "data_freshness", "--")}</span>
            <span>任务健康：{formatNumber(jobHealth.healthy_jobs, 0)} / {formatNumber(jobHealth.total_jobs, 0)}</span>
            <span>最后刷新：{displayDateTime(getString(data, "snapshot_at", ""))}</span>
          </div>
        </GlassCard>
      </section>

      <section className="content-grid">
        <GlassCard eyebrow="风险提示" title="提示">
          <div className="notice-list">
            {notices.length === 0 ? <EmptyState description="当前没有风险提示或系统提示，说明快照没有发现需要额外处理的事项。" title="暂无提示" tone="muted" /> : null}
            {notices.map((notice, index) => (
              <article className={`notice ${getString(notice, "level", "info")}`} key={`${getString(notice, "title")}-${index}`}>
                <b>{getString(notice, "title")}</b>
                <p>{getString(notice, "message")}</p>
              </article>
            ))}
          </div>
        </GlassCard>

        <GlassCard eyebrow="市场情绪" title="情绪指标">
          <div className="metric-list">
            {getRecords(sentiment, "metrics").map((metric) => (
              <article key={getString(metric, "key")}>
                <span>{getString(metric, "label")}</span>
                <strong>{formatNumber(metric.today, 0)}</strong>
                <em className={changeTone(metric.delta) === "up" ? "text-up" : changeTone(metric.delta) === "down" ? "text-down" : ""}>{formatNumber(metric.delta, 0)}</em>
              </article>
            ))}
          </div>
        </GlassCard>

        <GlassCard eyebrow="任务观察" title="重点任务">
          <div className="job-chip-list">
            {getRecords(shell, "watched_jobs").map((job) => (
              <span className={`job-chip ${getString(job, "health", "warning")}`} key={getString(job, "job_code")}>
                {getString(job, "name")} · {overviewStatusLabel(getString(job, "last_status", "未运行"))}
              </span>
            ))}
          </div>
        </GlassCard>
      </section>

        <GlassCard eyebrow={`${getString(plateRotation, "total", "0")} 个板块`} title="板块轮动预览">
        <div className="rotation-strip">
          {rotationSequence.slice(0, 12).map((item) => (
            <article key={item.code ?? item.name}>
              <b>{item.name}</b>
              <span>强度 {item.latestStrengthValue}</span>
              <small>{item.series.length} 日序列</small>
            </article>
          ))}
        </div>
        <TrendLineChart series={sequenceToTrendSeries(rotationSequence, 4)} />
      </GlassCard>
    </section>
  );
}

function overviewStatusLabel(value: string): string {
  const labels: Record<string, string> = {
    completed: "完成",
    failed: "失败",
    pending: "等待",
    queued: "排队",
    running: "运行中",
    skipped: "跳过",
    success: "成功",
    unknown: "未运行"
  };
  return labels[value] ?? value;
}

function formatIndexChange(value: unknown): string {
  const numeric = toNumber(value);
  if (numeric === null) {
    return "待同步";
  }
  return `${numeric > 0 ? "+" : ""}${formatNumber(numeric, 2)}%`;
}

function indexDisplayMeta(item: Record<string, unknown>): { code: string; market: string; name: string } {
  const rawCode = getString(item, "code", "");
  const rawName = getString(item, "name", "");
  const rawShortName = getString(item, "short_name", "");
  const rawMarket = getString(item, "market", "");
  const fallback = indexFallbackMeta(rawCode, rawShortName, rawName, rawMarket);
  const fallbackMarket = fallback?.market ?? rawMarket;
  const fallbackName = fallback?.name ?? (rawShortName || rawName);

  return {
    code: fallback?.code ?? (rawCode ? rawCode.toUpperCase() : "--"),
    market: hasChinese(rawMarket) ? rawMarket : fallbackMarket || "A 股",
    name: hasChinese(rawShortName) ? rawShortName : hasChinese(rawName) ? rawName : fallbackName || "--"
  };
}

function indexFallbackMeta(...values: string[]): { code: string; market: string; name: string } | undefined {
  const text = values.join(" ").toLowerCase();
  if (/\bsh\b|shanghai|000001/.test(text)) {
    return { code: "SH", market: "沪市", name: "上证指数" };
  }
  if (/\bsz\b|shenzhen|399001/.test(text)) {
    return { code: "SZ", market: "深市", name: "深证成指" };
  }
  if (/\bcy\b|chinext|399006/.test(text)) {
    return { code: "CY", market: "创业板", name: "创业板指" };
  }
  return undefined;
}

function hasChinese(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value);
}

function indexSparkBars(item: Record<string, unknown>, index: number): number[] {
  const value = toNumber(item.value ?? item.display_value) ?? 0;
  const change = toNumber(item.change_pct ?? item.change ?? item.change_value) ?? 0;
  const seed = Math.abs(Math.round(value * 10)) + Math.abs(Math.round(change * 100)) + index * 17;
  return Array.from({ length: 18 }, (_, barIndex) => {
    const wave = Math.sin((seed + barIndex * 29) / 19) * 16;
    const drift = Math.cos((seed + barIndex * 11) / 23) * 10;
    const trend = Math.max(-14, Math.min(14, change * 9)) * (barIndex / 17);
    return Math.max(22, Math.min(92, 48 + wave + drift + trend));
  });
}
