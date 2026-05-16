import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { KlineChart } from "./KlineChart";

const bars = [
  { trade_date: "2026-05-08", open_price: 10, close_price: 11, high_price: 11.4, low_price: 9.8, volume: 1200 },
  { trade_date: "2026-05-11", open_price: 11, close_price: 10.5, high_price: 11.2, low_price: 10.2, volume: 1800 },
  { trade_date: "2026-05-12", open_price: 10.5, close_price: 12.2, high_price: 12.6, low_price: 10.4, volume: 2400 },
  { trade_date: "2026-05-13", open_price: 12.2, close_price: 12.8, high_price: 13.1, low_price: 11.9, volume: 2200 },
  { trade_date: "2026-05-14", open_price: 12.8, close_price: 13.6, high_price: 14.1, low_price: 12.7, volume: 3600 }
];

describe("KlineChart", () => {
  it("renders candles, moving-average lines, close-price trend, volume bars and marker labels", () => {
    render(
      <KlineChart
        bars={bars}
        markers={[
          { date: "2026-05-12", label: "算力", tone: "hot" },
          { date: "2026-05-14", label: "芯片", tone: "info" }
        ]}
      />
    );

    expect(screen.getByLabelText("K线图")).toBeInTheDocument();
    expect(screen.getByText("MA3")).toBeInTheDocument();
    expect(screen.getByText("MA5")).toBeInTheDocument();
    expect(screen.getByText("成交量")).toBeInTheDocument();
    expect(screen.getByText("14.10")).toHaveClass("chart-price-label");
    expect(screen.getByText("9.80")).toHaveClass("chart-price-label");
    expect(screen.getByText("05-08")).toHaveClass("chart-date-label");
    expect(screen.getByText("05-14")).toHaveClass("chart-date-label");
    expect(screen.getByLabelText("收盘价折线")).toBeInTheDocument();
    expect(screen.getByLabelText("MA3均线")).toBeInTheDocument();
    expect(screen.getByLabelText("MA5均线")).toBeInTheDocument();
    expect(screen.getAllByTestId("volume-bar")).toHaveLength(5);
    expect(screen.getByText("算力")).toHaveClass("chart-marker-label");
    expect(screen.getByText("芯片")).toHaveClass("chart-marker-label");
  });

  it("marks the chart surface and legends for light-theme readable labels", () => {
    const { container } = render(<KlineChart bars={bars} />);

    expect(container.querySelector(".kline-chart")).toHaveClass("readable-chart");
    expect(screen.getByText("MA3")).toHaveClass("chart-legend-text");
    expect(screen.getByText("14.10")).toHaveClass("chart-price-label");
  });

  it("keeps dense node markers from overlapping while preserving marker hints", () => {
    const manyBars = Array.from({ length: 12 }, (_, index) => ({
      trade_date: `2026-05-${String(index + 1).padStart(2, "0")}`,
      open_price: 10 + index * 0.1,
      close_price: 10.4 + index * 0.1,
      high_price: 10.8 + index * 0.1,
      low_price: 9.8 + index * 0.1,
      volume: 1000 + index * 80
    }));
    const denseMarkers = manyBars.flatMap((bar, index) => [
      { date: String(bar.trade_date), label: `板块${index + 1}`, tone: "hot" as const },
      { date: String(bar.trade_date), label: `次线${index + 1}`, tone: "info" as const }
    ]);

    const { container } = render(<KlineChart bars={manyBars} markers={denseMarkers} />);

    expect(container.querySelectorAll(".chart-marker")).toHaveLength(12);
    expect(container.querySelectorAll(".chart-marker-label").length).toBeLessThan(12);
    expect(screen.getByText("板块1 / 次线1")).toHaveClass("chart-marker-label");
    expect(screen.getByText("2026-05-02 板块2 / 次线2")).toBeInTheDocument();
  });

  it("limits 21-day node marker labels to a small readable set", () => {
    const manyBars = Array.from({ length: 21 }, (_, index) => ({
      trade_date: `2026-04-${String(index + 1).padStart(2, "0")}`,
      open_price: 10 + index * 0.1,
      close_price: 10.4 + index * 0.1,
      high_price: 10.8 + index * 0.1,
      low_price: 9.8 + index * 0.1,
      volume: 1000 + index * 80
    }));

    const { container } = render(
      <KlineChart
        bars={manyBars}
        markers={manyBars.map((bar, index) => ({
          date: String(bar.trade_date),
          label: `板块${index + 1}`,
          tone: "hot" as const
        }))}
        maxBars={21}
      />
    );

    expect(container.querySelectorAll(".chart-marker")).toHaveLength(21);
    expect(container.querySelectorAll(".chart-marker-label").length).toBeLessThanOrEqual(6);
    expect(screen.getByText("2026-04-02 板块2")).toBeInTheDocument();
  });

  it("keeps an informative empty chart state", () => {
    render(<KlineChart bars={[]} />);

    expect(screen.getByText("暂无 K 线")).toBeInTheDocument();
  });

  it("ignores backend rows without usable price fields instead of drawing fake zero candles", () => {
    render(
      <KlineChart
        bars={[
          { trade_date: "2026-05-12", strength: 15.74, zt_count: 8 },
          { trade_date: "2026-05-13", latest_strength: 11.03 },
          { trade_date: "2026-05-14", open_price: 10, close_price: 10.8, high_price: 11.1, low_price: 9.9, volume: 1600 }
        ]}
      />
    );

    expect(screen.getByLabelText("K线图")).toBeInTheDocument();
    expect(screen.getAllByTestId("volume-bar")).toHaveLength(1);
    expect(screen.queryByText("0.00")).not.toBeInTheDocument();
  });

  it("shows the empty chart state when every backend row is not a valid K-line bar", () => {
    render(<KlineChart bars={[{ trade_date: "2026-05-12", strength: 15.74, zt_count: 8 }]} />);

    expect(screen.getByText("暂无 K 线")).toBeInTheDocument();
  });

  it("does not draw a misleading candle when a row only has one price-like field", () => {
    render(
      <KlineChart
        bars={[
          { trade_date: "2026-05-12", close_price: 15.74, zt_count: 8 },
          { trade_date: "2026-05-13", open_price: 10, close_price: 10.8, high_price: 11.1, low_price: 9.9, volume: 1600 }
        ]}
      />
    );

    expect(screen.getByLabelText("K线图")).toBeInTheDocument();
    expect(screen.getAllByTestId("volume-bar")).toHaveLength(1);
    expect(screen.queryByText("15.74")).not.toBeInTheDocument();
  });

  it("requires full OHLC prices before drawing a K-line candle", () => {
    render(
      <KlineChart
        bars={[
          { trade_date: "2026-05-12", open_price: 15.1, close_price: 15.74, strength: 15.74 },
          { trade_date: "2026-05-13", open_price: 10, close_price: 10.8, high_price: 11.1, low_price: 9.9, volume: 1600 }
        ]}
      />
    );

    expect(screen.getByLabelText("K线图")).toBeInTheDocument();
    expect(screen.getAllByTestId("volume-bar")).toHaveLength(1);
    expect(screen.queryByText("15.74")).not.toBeInTheDocument();
  });

  it("can limit the visible candle count for dense node charts", () => {
    const manyBars = Array.from({ length: 30 }, (_, index) => ({
      trade_date: `2026-04-${String(index + 1).padStart(2, "0")}`,
      open_price: 10 + index,
      close_price: 10.5 + index,
      high_price: 10.8 + index,
      low_price: 9.8 + index,
      volume: 1000 + index
    }));

    render(<KlineChart bars={manyBars} maxBars={21} />);

    expect(screen.getAllByTestId("volume-bar")).toHaveLength(21);
    expect(screen.queryByText("04-01")).not.toBeInTheDocument();
    expect(screen.getByText("04-30")).toBeInTheDocument();
  });

  it("allows K-line dates to be clicked for page-level linkage", async () => {
    const user = userEvent.setup();
    const selected: string[] = [];
    render(<KlineChart bars={bars} onSelectDate={(date) => selected.push(date)} />);

    await user.click(screen.getByRole("button", { name: "选择 K 线日期 2026-05-13" }));

    expect(selected).toEqual(["2026-05-13"]);
  });
});
