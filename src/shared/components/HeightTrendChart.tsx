import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";

export type HeightTrendItem = {
  date: string;
  leaderCode?: string;
  leaderName?: string;
  stockCount?: number;
  value: number;
};

type HeightTrendChartProps = {
  activeDate?: string;
  items: HeightTrendItem[];
  onSelectDate: (date: string) => void;
};

export function HeightTrendChart({ activeDate, items, onSelectDate }: HeightTrendChartProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const visible = items.filter((item) => item.date).slice(-20);
  const lastVisible = lastItem(visible);
  const safeActiveDate = activeDate && visible.some((item) => item.date === activeDate) ? activeDate : lastVisible?.date ?? "";
  const activeItem = visible.find((item) => item.date === safeActiveDate) ?? lastVisible;

  const chart = useMemo(() => buildChart(visible), [visible]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || visible.length === 0) return;
    const left = Math.max(0, rail.scrollWidth - rail.clientWidth);
    if (typeof rail.scrollTo === "function") {
      rail.scrollTo({ behavior: "auto", left });
    } else {
      rail.scrollLeft = left;
    }
  }, [safeActiveDate, visible.length]);

  if (visible.length === 0 || !chart) {
    return <div className="height-trend-chart empty-chart">暂无高度曲线</div>;
  }

  return (
    <div className="height-trend-chart">
      <div className="height-trend-head">
        <div>
          <b>高度折线</b>
          <span>日期和曲线联动，下方高标列会跟随选中交易日。</span>
        </div>
        <div className="height-trend-active">
          <span data-testid="height-chart-active-date">{activeItem?.date ?? "--"}</span>
          <b>{activeItem?.value ?? "--"} 板</b>
          <small>{cleanLeader(activeItem?.leaderName)}</small>
        </div>
      </div>

      <div className="height-trend-plot">
        <div
          className="height-trend-scale"
          style={{
            "--height-trend-left": `${(chart.left / chart.width) * 100}%`,
            "--height-trend-right": `${((chart.width - chart.right) / chart.width) * 100}%`
          } as CSSProperties}
        >
        <svg aria-label="连板高度折线图" preserveAspectRatio="none" role="img" viewBox={`0 0 ${chart.width} ${chart.height}`}>
          <defs>
            <linearGradient id="heightTrendFill" x1="0" x2="0" y1="0" y2="1">
              <stop stopColor="rgba(255,77,85,.28)" />
              <stop offset="1" stopColor="rgba(245,158,11,.05)" />
            </linearGradient>
          </defs>
          <g className="height-trend-grid">
            {chart.ticks.map((tick) => (
              <line key={tick.label} x1="50" x2={chart.width - 24} y1={tick.y} y2={tick.y} />
            ))}
          </g>
          <g className="height-axis-values">
            {chart.ticks.map((tick, index) => (
              <text className="height-axis-value" key={tick.label} textAnchor="start" x="10" y={tick.y + 4}>
                {index === 0 ? `最高 ${tick.value} 板` : `${tick.value} 板`}
              </text>
            ))}
          </g>
          <path className="height-trend-area" d={chart.areaPath} />
          <path className="height-trend-line" d={chart.linePath} />
          {chart.points.map((point) => {
            const active = point.item.date === safeActiveDate;
            return (
              <g className={`height-trend-point ${active ? "active" : ""}`} key={point.item.date}>
                {active ? <line className="height-active-line" x1={point.x} x2={point.x} y1={chart.top - 6} y2={chart.bottom + 10} /> : null}
                <circle cx={point.x} cy={point.y} r={active ? 7 : 4.6}>
                  <title>{`${point.item.date} ${point.item.value}板 ${cleanLeader(point.item.leaderName)}`}</title>
                </circle>
                <text className="height-point-value" textAnchor="middle" x={point.x} y={point.y - 14}>
                  {point.item.value}
                </text>
              </g>
            );
          })}
          <g className="height-axis-labels">
            <text x="40" y={chart.height - 12}>{shortDate(visible[0]?.date)}</text>
            <text textAnchor="end" x={chart.width - 28} y={chart.height - 12}>{shortDate(lastVisible?.date)}</text>
          </g>
        </svg>
        <div className="height-trend-hit-layer" aria-hidden={false} data-layer="below-line">
          {chart.points.map((point) => (
            <button
              aria-label={`选择折线日期 ${point.item.date} 高度 ${point.item.value} 板`}
              className={point.item.date === safeActiveDate ? "height-trend-hit active" : "height-trend-hit"}
              key={`${point.item.date}-curve-hit`}
              onClick={() => onSelectDate(point.item.date)}
              style={{
                left: `${(point.x / chart.width) * 100}%`,
                top: `${(point.y / chart.height) * 100}%`
              }}
              type="button"
            />
          ))}
        </div>
        </div>
      </div>

      <div
        className="height-date-rail height-trend-scale"
        aria-label="连板高度日期选择"
        ref={railRef}
        style={{
          "--height-trend-count": Math.max(visible.length, 1),
          "--height-trend-left": `${(chart.left / chart.width) * 100}%`,
          "--height-trend-right": `${((chart.width - chart.right) / chart.width) * 100}%`
        } as CSSProperties}
      >
        {chart.points.map((point) => (
          <button
            aria-label={`选择 ${point.item.date} 高度 ${point.item.value} 板`}
            className={point.item.date === safeActiveDate ? "active" : ""}
            key={point.item.date}
            onClick={() => onSelectDate(point.item.date)}
            style={{ left: `${(point.x / chart.width) * 100}%` }}
            type="button"
          >
            <span>{shortDate(point.item.date)}</span>
            <b>{point.item.value}板</b>
            <small>{cleanLeader(point.item.leaderName)}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function buildChart(items: HeightTrendItem[]) {
  if (items.length === 0) return null;
  const width = 780;
  const height = 250;
  const top = 28;
  const bottom = 184;
  const left = 46;
  const right = width - 34;
  const values = items.map((item) => item.value);
  const max = Math.max(...values, 3);
  const min = Math.max(0, Math.min(...values) - 1);
  const span = Math.max(max - min, 1);
  const xAt = (index: number) => (items.length <= 1 ? (left + right) / 2 : left + (index / (items.length - 1)) * (right - left));
  const yAt = (value: number) => bottom - ((value - min) / span) * (bottom - top);
  const points = items.map((item, index) => ({ item, x: xAt(index), y: yAt(item.value) }));
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const finalPoint = lastItem(points);
  const areaPath = `${linePath} L ${finalPoint?.x.toFixed(2)} ${bottom} L ${points[0]?.x.toFixed(2)} ${bottom} Z`;
  const ticks = [max, Math.round(min + span * 0.75), Math.round(min + span * 0.5), Math.round(min + span * 0.25), min]
    .map((value, index) => ({ label: `${value}-${index}`, value, y: yAt(value) }));
  return { areaPath, bottom, height, left, linePath, points, right, ticks, top, width };
}

export function normalizeHeightTrendItems(items: Array<Record<string, unknown>>): HeightTrendItem[] {
  return items
    .map((item) => ({
      date: String(item.date ?? item.trade_date ?? ""),
      leaderCode: optionalString(item.leader_code ?? item.stock_code),
      leaderName: optionalString(item.leader_name ?? item.stock_name),
      stockCount: optionalNumber(item.stock_count ?? item.count),
      value: optionalNumber(item.value ?? item.height ?? item.board_height) ?? 0
    }))
    .filter((item) => item.date && Number.isFinite(item.value));
}

function optionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[,%]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function cleanLeader(value?: string): string {
  return value?.trim() ? value.replace(/\n/g, " / ") : "--";
}

function shortDate(value?: string): string {
  return value && value.length >= 10 ? value.slice(5, 10) : value ?? "--";
}

function lastItem<T>(items: T[]): T | undefined {
  return items.length > 0 ? items[items.length - 1] : undefined;
}
