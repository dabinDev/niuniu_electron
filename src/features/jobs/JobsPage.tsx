import { useMutation, useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { useRef, useState } from "react";
import { buildQuery, getRecord, getRecords, getString, recordListToTable } from "../../core/api/data";
import { queryKeys } from "../../core/api/queryKeys";
import { useApiClient } from "../../core/api/useApiClient";
import { displayDateTime } from "../../core/format/date";
import { errorMessage } from "../../core/format/error";
import { DataTable } from "../../shared/components/DataTable";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { ExportActions } from "../../shared/components/ExportActions";
import { GlassCard } from "../../shared/components/GlassCard";
import { LoadingState } from "../../shared/components/LoadingState";
import { MetricCard } from "../../shared/components/MetricCard";
import { PageHeader } from "../../shared/components/PageHeader";

export function JobsPage() {
  const client = useApiClient();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryFn: () => client.getMap(`/internal/jobs/page${buildQuery({ force_refresh: forceRefresh })}`),
    queryKey: queryKeys.jobs(forceRefresh)
  });
  const trigger = useMutation({
    mutationFn: (jobCode: string) => client.postMap(`/internal/jobs/${encodeURIComponent(jobCode)}/trigger`, {}),
    onSuccess: (_data, jobCode) => {
      setMessage(`${jobCode} 已触发`);
      query.refetch();
    },
    onError: (error) => setMessage(errorMessage(error))
  });

  if (query.isLoading) return <LoadingState title="正在加载任务中心" />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;
  const data = query.data;
  if (!data) return <EmptyState action="刷新任务中心" description="任务中心没有返回服务和任务数据，请确认内部管理接口可用。" title="任务中心暂无数据" tone="market" />;
  const summary = getRecord(data, "summary");
  const services = getRecords(data, "services");
  const jobs = getRecords(data, "jobs");
  const runs = getRecords(data, "recent_runs");
  const failedJobs = getString(summary, "failed_jobs", "0");
  const jobTable = recordListToTable(jobs, ["job_code", "name", "enabled", "schedule_mode", "health", "last_status", "last_rows_written", "trigger_allowed"]);
  const runTable = recordListToTable(runs, ["run_id", "job_code", "status", "started_at", "duration_ms", "rows_written", "message"]);
  const sheets = [
    { name: "任务列表", rows: [jobTable.columns.map((c) => c.label), ...jobTable.rows.map((r) => jobTable.columns.map((c) => String(r.values[c.key] ?? "")))] },
    { name: "运行记录", rows: [runTable.columns.map((c) => c.label), ...runTable.rows.map((r) => runTable.columns.map((c) => String(r.values[c.key] ?? "")))] }
  ];

  return (
    <section className="page-scroll" ref={workspaceRef}>
      <PageHeader
        actions={<ExportActions onRefresh={() => { setForceRefresh((value) => !value); query.refetch(); }} payload={data} sheets={sheets} targetRef={workspaceRef} title="任务中心" />}
        description="监控本地服务、抓取任务、最近运行和失败记录，并支持手动触发任务。"
        meta={displayDateTime(getString(data, "generated_at", ""))}
        title="任务中心"
      />
      <section className="metric-grid jobs-metric-grid">
        <MetricCard label="任务总数" value={getString(summary, "total_jobs", "0")} />
        <MetricCard label="启用任务" tone="up" value={getString(summary, "enabled_jobs", "0")} />
        <MetricCard label="健康任务" tone="up" value={getString(summary, "healthy_jobs", "0")} />
        <MetricCard label="失败任务" tone="down" value={failedJobs} />
      </section>
      {message ? <div className="inline-message">{message}</div> : null}
      <section aria-label="任务调度控制台" className="jobs-workspace jobs-control-deck">
        <GlassCard className="jobs-service-card" eyebrow="服务监控" title="服务状态">
          <div className="jobs-card-caption">
            <span>{services.length} 个探针</span>
            <b>{failedJobs === "0" ? "链路平稳" : `${failedJobs} 个任务异常`}</b>
          </div>
          <div className="service-grid">
            {services.length === 0 ? <EmptyState description="暂未返回服务探针状态。" title="暂无服务状态" tone="muted" /> : null}
            {services.map((service) => {
              const running = getString(service, "running") === "true" || service.running === true;
              const ready = getString(service, "ready") === "true" || service.ready === true;
              return (
                <article className={`job-service-item ${running && ready ? "is-ok running" : "is-alert"}`} key={getString(service, "name")}>
                  <div className="service-title-row">
                    <span className="service-led" />
                    <b>{getString(service, "name")}</b>
                    <i className="service-kind-pill">{serviceKindLabel(getString(service, "kind"))}</i>
                  </div>
                  <span className="service-target">{getString(service, "probe_target", "--")}</span>
                  <small className="service-state-row">
                    <span className={`status-chip ${running ? "status-up" : "status-down"}`}>{running ? "运行中" : "未运行"}</span>
                    <span className={`status-chip ${ready ? "status-up" : "status-warning"}`}>{ready ? "就绪" : "未就绪"}</span>
                  </small>
                </article>
              );
            })}
          </div>
        </GlassCard>
        <GlassCard className="jobs-list-card" eyebrow="任务调度" title="任务列表">
          <div className="task-list">
            {jobs.length === 0 ? <EmptyState description="暂未返回可调度任务。" title="暂无任务" tone="muted" /> : null}
            {jobs.map((job) => {
              const health = getString(job, "health");
              const lastStatus = statusText(getString(job, "last_status", "未运行"));
              const scheduleMode = scheduleModeLabel(getString(job, "schedule_mode"));
              return (
                <article className={`task-item ${taskStateClass(health)}`} key={getString(job, "job_code")}>
                  <div className="task-main">
                    <div className="task-title-line">
                      <b>{getString(job, "name")}</b>
                      <i className={`status-chip ${health === "healthy" ? "status-up" : health === "failed" ? "status-down" : "status-warning"}`}>{healthLabel(health)}</i>
                    </div>
                    <span className="task-code-line">
                      <code>{getString(job, "job_code")}</code>
                      <span>{scheduleMode}</span>
                    </span>
                  </div>
                  <div className="task-meta-grid">
                    <span>
                      <small>调度方式</small>
                      <b>{scheduleMode}</b>
                    </span>
                    <span>
                      <small>最近状态</small>
                      <b>{lastStatus}</b>
                    </span>
                    <span>
                      <small>最近开始</small>
                      <b>{displayDateTime(getString(job, "last_started_at", ""))}</b>
                    </span>
                  </div>
                  <div className="task-run">
                    <small>上次状态：{lastStatus}</small>
                  </div>
                  <div className="task-count">
                    <span>写入</span>
                    <b>{getString(job, "last_rows_written", "0")}</b>
                    <small>行</small>
                  </div>
                  <div className="task-trigger-cell">
                    <button
                      className="ghost-button icon-label small"
                      disabled={!job.trigger_allowed || trigger.isPending}
                      onClick={() => trigger.mutate(getString(job, "job_code"))}
                      type="button"
                    >
                      <Play size={13} />
                      触发
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </GlassCard>
      </section>
      <GlassCard className="jobs-runs-card" actions={<span className="jobs-runs-toolbar">最近 {runTable.rows.length} 条</span>} eyebrow="运行记录" title="最近运行">
        {runTable.rows.length === 0 ? <EmptyState action="触发一次任务" description="任务执行后，最近运行记录会显示运行编号、耗时、写入行数和消息。" title="暂无运行记录" tone="muted" /> : <DataTable columns={runTable.columns} rows={runTable.rows} />}
      </GlassCard>
    </section>
  );
}

function healthLabel(value: string): string {
  const labels: Record<string, string> = {
    failed: "失败",
    healthy: "健康",
    unknown: "未知",
    warning: "警告"
  };
  return labels[value] ?? value;
}

function serviceKindLabel(value: string): string {
  const labels: Record<string, string> = {
    api: "接口",
    backend: "后端",
    browser: "浏览器",
    database: "数据库",
    scheduler: "调度器",
    worker: "任务进程"
  };
  return labels[value] ?? value;
}

function scheduleModeLabel(value: string): string {
  const labels: Record<string, string> = {
    cron: "定时调度",
    interval: "间隔调度",
    manual: "手动触发",
    realtime: "实时任务",
    startup: "启动运行"
  };
  return labels[value] ?? value;
}

function statusText(value: string): string {
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

function taskStateClass(health: string): string {
  if (health === "healthy") return "is-ok";
  if (health === "failed") return "is-danger";
  return "is-warning";
}
