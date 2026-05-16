import clsx from "clsx";
import type { ReactNode } from "react";

export type WorkspaceSummaryItem = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "amber" | "blue" | "down" | "neutral" | "up";
};

export function WorkspaceSummaryBar({
  actions,
  detail,
  items,
  title = "工作台摘要"
}: {
  actions?: ReactNode;
  detail?: ReactNode;
  items: WorkspaceSummaryItem[];
  title?: string;
}) {
  return (
    <section className="workspace-summary-bar">
      <div className="workspace-summary-title">
        <span>{title}</span>
        {detail ? <small>{detail}</small> : null}
      </div>
      <div className="workspace-summary-metrics">
        {items.map((item) => (
          <article className={clsx("summary-metric", `tone-${item.tone ?? "neutral"}`)} key={item.label}>
            <span>{item.label}</span>
            <b>{item.value}</b>
            {item.detail ? <small>{item.detail}</small> : null}
          </article>
        ))}
      </div>
      {actions ? <div className="workspace-summary-actions">{actions}</div> : null}
    </section>
  );
}
