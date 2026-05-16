import { useId } from "react";

export type TrendPoint = {
  hint?: string;
  label: string;
  value?: null | number;
};

export type TrendSeries = {
  name: string;
  points: TrendPoint[];
  tone?: "amber" | "down" | "info" | "neutral" | "up";
};

export function TrendLineChart({ series }: { series: TrendSeries[] }) {
  const gradientId = useId().replace(/:/g, "");
  const width = 760;
  const height = 190;
  const chartTop = 20;
  const chartBottom = 154;
  const normalized = series.map((item) => ({
    ...item,
    points: item.points.map((point, index) => ({
      ...point,
      index,
      value: typeof point.value === "number" && Number.isFinite(point.value) ? point.value : null
    }))
  }));
  const values = normalized.flatMap((item) => item.points.map((point) => point.value).filter((value): value is number => value !== null));
  if (values.length === 0) {
    return <div className="trend-line-chart empty-chart">暂无趋势数据</div>;
  }

  const maxPointCount = Math.max(...normalized.map((item) => item.points.length), 1);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(max - min, 0.01);
  const xAt = (index: number) => (maxPointCount <= 1 ? width / 2 : 26 + (index / (maxPointCount - 1)) * (width - 52));
  const yAt = (value: number) => chartTop + ((max - value) / span) * (chartBottom - chartTop);
  const labelPoints = normalized[0]?.points ?? [];
  const labelIndexes = labelPoints.length <= 1
    ? [0]
    : Array.from(new Set([0, Math.ceil((labelPoints.length - 1) / 2), labelPoints.length - 1]));
  const yTicks = [max, (max + min) / 2, min];

  return (
    <div className="trend-line-chart">
      <svg aria-label="趋势折线图" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {normalized.map((item, index) => (
            <linearGradient id={`${gradientId}-trend-${index}`} key={item.name} x1="0" x2="0" y1="0" y2="1">
              <stop className={`trend-stop-strong tone-${item.tone ?? "neutral"}`} />
              <stop className={`trend-stop-soft tone-${item.tone ?? "neutral"}`} offset="1" />
            </linearGradient>
          ))}
        </defs>
        <g className="trend-grid">
          {yTicks.map((value, index) => (
            <line key={`${value}-${index}`} x1="34" x2={width - 58} y1={yAt(value)} y2={yAt(value)} />
          ))}
          {[0, 1, 2, 3, 4].map((line) => (
            <line className="trend-grid-vertical" key={line} x1={34 + line * ((width - 92) / 4)} x2={34 + line * ((width - 92) / 4)} y1={chartTop} y2={chartBottom} />
          ))}
        </g>
        <g className="trend-axis-values">
          {yTicks.map((value, index) => (
            <text className="trend-axis-value" key={`${value}-${index}`} textAnchor="end" x={width - 14} y={yAt(value) + 4}>
              {formatAxisValue(value)}
            </text>
          ))}
        </g>
        {normalized.map((item, index) => {
          const validPoints = item.points.filter((point): point is TrendPoint & { index: number; value: number } => point.value !== null);
          const linePath = toPath(validPoints.map((point) => [xAt(point.index), yAt(point.value)]));
          const areaPath = toAreaPath(validPoints.map((point) => [xAt(point.index), yAt(point.value)]), chartBottom);
          return (
            <g className={`trend-series tone-${item.tone ?? "neutral"}`} key={item.name}>
              <path className="trend-area" d={areaPath} fill={`url(#${gradientId}-trend-${index})`} />
              <path className="trend-line" d={linePath} />
              {validPoints.map((point) => (
                <circle className="trend-point" cx={xAt(point.index)} cy={yAt(point.value)} key={`${item.name}-${point.label}-${point.index}`} r="2.4">
                  <title>{`${item.name} ${point.label} ${point.hint ?? formatAxisValue(point.value)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        <g className="trend-axis-labels">
          {labelIndexes.map((index) => (
            <text
              key={`${labelPoints[index]?.label}-${index}`}
              textAnchor={index === 0 ? "start" : index === labelPoints.length - 1 ? "end" : "middle"}
              x={xAt(index)}
              y="178"
            >
              {labelPoints[index]?.label}
            </text>
          ))}
        </g>
      </svg>
      <div className="trend-legend">
        {normalized.map((item) => (
          <span className={`tone-${item.tone ?? "neutral"}`} key={item.name}>
            <i />
            {item.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function toPath(points: number[][]): string {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
}

function toAreaPath(points: number[][], baseline: number): string {
  if (points.length === 0) {
    return "";
  }
  const line = toPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last[0].toFixed(2)} ${baseline} L ${first[0].toFixed(2)} ${baseline} Z`;
}

function formatAxisValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
