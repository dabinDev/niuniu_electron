import { getNumber, getString } from "../../core/api/data";

export type ChartMarker = {
  date: string;
  label: string;
  tone?: "hot" | "info" | "risk";
};

export function KlineChart({
  bars,
  markers = [],
  maxBars = 48,
  onSelectDate
}: {
  bars: Array<Record<string, unknown>>;
  markers?: ChartMarker[];
  maxBars?: number;
  onSelectDate?: (date: string) => void;
}) {
  const normalized = bars.map(normalizeBar).filter((bar): bar is NormalizedKlineBar => Boolean(bar)).slice(-Math.max(1, maxBars));
  if (normalized.length === 0) {
    return <div className="mini-chart empty-chart">暂无 K 线</div>;
  }
  const highs = normalized.map((bar) => bar.high);
  const lows = normalized.map((bar) => bar.low);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const span = Math.max(max - min, 0.01);
  const width = 760;
  const height = 260;
  const plotLeft = 48;
  const plotRight = width - 104;
  const priceHeight = 188;
  const volumeTop = 204;
  const volumeHeight = 42;
  const plotWidth = Math.max(1, plotRight - plotLeft);
  const step = plotWidth / normalized.length;
  const maxVolume = Math.max(...normalized.map((bar) => bar.volume), 1);
  const xAt = (index: number) => normalized.length === 1 ? (plotLeft + plotRight) / 2 : plotLeft + index * step + step / 2;
  const yAt = (value: number) => ((max - value) / span) * (priceHeight - 24) + 12;
  const closePath = toPath(normalized.map((bar, index) => [xAt(index), yAt(bar.close)]));
  const ma3Path = toPath(movingAverage(normalized.map((bar) => bar.close), 3).map((value, index) => [xAt(index), yAt(value)]));
  const ma5Path = toPath(movingAverage(normalized.map((bar) => bar.close), 5).map((value, index) => [xAt(index), yAt(value)]));
  const priceTicks = [max, (max + min) / 2, min];
  const dateTicks = normalized.length === 1 ? [0] : Array.from(new Set([0, Math.floor((normalized.length - 1) / 2), normalized.length - 1]));
  const markerGroups = groupMarkers(markers, normalized, xAt);

  return (
    <div className="kline-chart readable-chart">
      <svg aria-label="K线图" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="klineGlow" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="rgba(255,77,85,.25)" />
            <stop offset="1" stopColor="rgba(24,195,126,.08)" />
          </linearGradient>
        </defs>
        <rect fill="url(#klineGlow)" height={height} rx="18" width={width} />
        <g className="chart-grid-lines">
          {priceTicks.map((value) => (
            <line key={value} x1={plotLeft - 16} x2={plotRight + 20} y1={yAt(value)} y2={yAt(value)} />
          ))}
        </g>
        <path aria-label="收盘价折线" className="chart-close-line" d={closePath} />
        <path aria-label="MA3均线" className="chart-ma-line ma-short" d={ma3Path} />
        <path aria-label="MA5均线" className="chart-ma-line ma-long" d={ma5Path} />
        <g className="chart-price-axis">
          {priceTicks.map((value) => (
            <text className="chart-price-label" key={value} textAnchor="end" x={width - 14} y={yAt(value) + 4}>
              {value.toFixed(2)}
            </text>
          ))}
        </g>
        <g className="chart-legend">
          <text className="chart-legend-text legend-close" x="18" y="24">收盘</text>
          <text className="chart-legend-text legend-ma-short" x="72" y="24">MA3</text>
          <text className="chart-legend-text legend-ma-long" x="122" y="24">MA5</text>
          <text className="chart-legend-text legend-volume" x="172" y="24">成交量</text>
        </g>
        <g className="chart-date-axis">
          {dateTicks.map((index) => (
            <text className="chart-date-label" key={normalized[index].date || index} textAnchor={index === 0 ? "start" : index === normalized.length - 1 ? "end" : "middle"} x={xAt(index)} y={height - 8}>
              {shortDate(normalized[index].date)}
            </text>
          ))}
        </g>
        {normalized.map((bar, index) => {
          const x = xAt(index);
          const yHigh = yAt(bar.high);
          const yLow = yAt(bar.low);
          const yOpen = yAt(bar.open);
          const yClose = yAt(bar.close);
          const candleTop = Math.min(yOpen, yClose);
          const candleHeight = Math.max(Math.abs(yOpen - yClose), 3);
          const volumeHeightValue = Math.max(3, (bar.volume / maxVolume) * volumeHeight);
          const up = bar.close >= bar.open;
          return (
            <g className={onSelectDate ? "chart-date-group clickable" : "chart-date-group"} key={`${bar.date || index}-${index}`}>
              <rect
                className={up ? "volume-up" : "volume-down"}
                data-testid="volume-bar"
                height={volumeHeightValue}
                rx="2"
                width={Math.max(step * 0.42, 3)}
                x={x - Math.max(step * 0.42, 3) / 2}
                y={volumeTop + volumeHeight - volumeHeightValue}
              />
              <line className={up ? "candle-up" : "candle-down"} x1={x} x2={x} y1={yHigh} y2={yLow} />
              <rect className={up ? "candle-up" : "candle-down"} height={candleHeight} rx="2" width={Math.max(step * 0.54, 3)} x={x - Math.max(step * 0.54, 3) / 2} y={candleTop} />
            </g>
          );
        })}
        {markerGroups.map((group) => {
          const label = group.markers.map((marker) => marker.label).join(" / ");
          return (
            <g className={`chart-marker tone-${group.tone}`} key={`${group.date}-${label}`}>
              <line x1={group.x} x2={group.x} y1="10" y2={volumeTop + volumeHeight} />
              <title>{`${group.date} ${label}`}</title>
              {group.showLabel ? (
                <text className="chart-marker-label" x={Math.min(width - 42, Math.max(20, group.x))} y={group.labelY}>
                  {label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {onSelectDate ? (
        <div className="chart-date-hit-layer" aria-hidden={false}>
          {normalized.map((bar, index) => {
            const x = xAt(index);
            return (
              <button
                aria-label={`选择 K 线日期 ${bar.date}`}
                className="chart-date-hit"
                key={`${bar.date || index}-hit`}
                onClick={() => onSelectDate(bar.date)}
                style={{
                  left: `${((x - step / 2) / width) * 100}%`,
                  width: `${(step / width) * 100}%`
                }}
                type="button"
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function movingAverage(values: number[], windowSize: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const window = values.slice(start, index + 1);
    return window.reduce((sum, value) => sum + value, 0) / window.length;
  });
}

function price(record: Record<string, unknown>, primary: string, fallback: string): number | undefined {
  return getNumber(record, primary) ?? getNumber(record, fallback);
}

type NormalizedKlineBar = {
  close: number;
  date: string;
  high: number;
  low: number;
  open: number;
  volume: number;
};

function normalizeBar(bar: Record<string, unknown>): NormalizedKlineBar | null {
  const open = price(bar, "open_price", "open");
  const close = price(bar, "close_price", "close");
  const high = price(bar, "high_price", "high");
  const low = price(bar, "low_price", "low");
  if (open === undefined || close === undefined || high === undefined || low === undefined) {
    return null;
  }
  return {
    close,
    date: getString(bar, "trade_date", getString(bar, "date", "")),
    high,
    low,
    open,
    volume: price(bar, "volume", "vol") ?? price(bar, "amount", "turnover") ?? 0
  };
}

function toPath(points: number[][]): string {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
}

function groupMarkers(markers: ChartMarker[], bars: Array<{ date: string }>, xAt: (index: number) => number) {
  const byDate = new Map<string, ChartMarker[]>();
  markers.forEach((marker) => {
    if (!byDate.has(marker.date)) {
      byDate.set(marker.date, []);
    }
    byDate.get(marker.date)?.push(marker);
  });
  let lastLabelX = -Infinity;
  let labelCount = 0;
  const labelGap = bars.length >= 18 ? 132 : 72;
  return Array.from(byDate.entries())
    .map(([date, dateMarkers]) => {
      const index = bars.findIndex((bar) => bar.date === date);
      if (index < 0) return null;
      const x = xAt(index);
      const showLabel = x - lastLabelX >= labelGap;
      if (showLabel) {
        lastLabelX = x;
        labelCount += 1;
      }
      return {
        date,
        labelY: 48 + ((labelCount - 1) % 2) * 16,
        markers: dateMarkers.slice(0, 2),
        showLabel,
        tone: dateMarkers[0]?.tone ?? "info",
        x
      };
    })
    .filter((group): group is NonNullable<typeof group> => Boolean(group));
}

function shortDate(value: string): string {
  return value.length >= 10 ? value.slice(5, 10) : value || "--";
}
