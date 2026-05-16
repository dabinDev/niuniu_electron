import clsx from "clsx";

export function MetricCard({ delay = 0, label, tone = "neutral", value, delta }: { delay?: number; delta?: string; label: string; tone?: "down" | "neutral" | "up"; value: string }) {
  return (
    <article className="metric-card" style={{ "--delay": `${delay}ms` } as React.CSSProperties}>
      <label>{label}</label>
      <strong className={clsx(tone === "up" && "text-up", tone === "down" && "text-down")}>{value}</strong>
      {delta ? <span className={clsx(tone === "up" && "text-up", tone === "down" && "text-down")}>{delta}</span> : null}
    </article>
  );
}
