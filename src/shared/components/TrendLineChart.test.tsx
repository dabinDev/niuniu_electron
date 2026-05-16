import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrendLineChart } from "./TrendLineChart";

const series = [
  {
    name: "算力",
    points: [
      { label: "04-13", value: 4.84 },
      { label: "04-14", value: 9.65 },
      { label: "04-15", value: 5.19 },
      { label: "04-16", value: 16.75 }
    ],
    tone: "up" as const
  },
  {
    name: "芯片",
    points: [
      { label: "04-13", value: 4.89 },
      { label: "04-14", value: 7.08 },
      { label: "04-15", value: 1.99 },
      { label: "04-16", value: 3.25 }
    ],
    tone: "info" as const
  }
];

describe("TrendLineChart", () => {
  it("renders multiple trend lines, area layers, point markers and legend labels", () => {
    const { container } = render(<TrendLineChart series={series} />);

    expect(screen.getByLabelText("趋势折线图")).toBeInTheDocument();
    expect(screen.getByText("算力")).toBeInTheDocument();
    expect(screen.getByText("芯片")).toBeInTheDocument();
    expect(container.querySelectorAll(".trend-line")).toHaveLength(2);
    expect(container.querySelectorAll(".trend-area")).toHaveLength(2);
    expect(container.querySelectorAll(".trend-point")).toHaveLength(8);
    expect(container.querySelectorAll(".trend-axis-value")).toHaveLength(3);
    expect(screen.getByText("16.75")).toHaveClass("trend-axis-value");
    expect(screen.getByText("04-13")).toBeInTheDocument();
    expect(screen.getByText("04-15")).toBeInTheDocument();
    expect(screen.getByText("04-16")).toBeInTheDocument();
  });

  it("keeps a readable empty state when no series has values", () => {
    render(<TrendLineChart series={[{ name: "空数据", points: [{ label: "05-14", value: null }] }]} />);

    expect(screen.getByText("暂无趋势数据")).toBeInTheDocument();
  });

  it("formats integer axis values without noisy decimal zeros", () => {
    render(<TrendLineChart series={[{
      name: "芯片",
      points: [
        { label: "05-13", value: 15740 },
        { label: "05-14", value: 12619 }
      ]
    }]} />);

    expect(screen.getByText("15740")).toHaveClass("trend-axis-value");
    expect(screen.queryByText("15740.00")).not.toBeInTheDocument();
  });
});
