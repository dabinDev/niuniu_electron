import clsx from "clsx";

export function EmptyState({
  action,
  description = "后端返回为空，启动抓取任务或切换交易日后会自动填充。",
  hint,
  title = "暂无数据",
  tone = "default"
}: {
  action?: string;
  description?: string;
  hint?: string;
  title?: string;
  tone?: "default" | "market" | "muted";
}) {
  return (
    <div className={clsx("state-block", `state-${tone}`)}>
      <b>{title}</b>
      <p>{description}</p>
      {action ? <span className="empty-state-action">{action}</span> : null}
      {hint ? <small className="empty-state-hint">{hint}</small> : null}
    </div>
  );
}
