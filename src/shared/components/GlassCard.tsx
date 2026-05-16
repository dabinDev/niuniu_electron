import type { ReactNode } from "react";

export function GlassCard({ actions, children, className = "", eyebrow, title }: { actions?: ReactNode; children: ReactNode; className?: string; eyebrow?: string; title?: string }) {
  return (
    <article className={`glass-card ${className}`}>
      {title ? (
        <header className="card-head">
          <div>
            {eyebrow ? <span className="card-eyebrow">{eyebrow}</span> : null}
            <b>{title}</b>
          </div>
          {actions}
        </header>
      ) : null}
      {children}
    </article>
  );
}
