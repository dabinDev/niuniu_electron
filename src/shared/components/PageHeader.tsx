import type { ReactNode } from "react";

export function PageHeader({ actions, description, eyebrow = "复盘工作室", meta, title }: { actions?: ReactNode; description: string; eyebrow?: string; meta?: string; title: string }) {
  return (
    <section className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-head-actions">
        {meta ? <div className="date-pill">{meta}</div> : null}
        {actions}
      </div>
    </section>
  );
}
