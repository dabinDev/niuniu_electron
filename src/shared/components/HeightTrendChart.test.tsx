import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HeightTrendChart } from "./HeightTrendChart";

const items = [
  { date: "2026-05-10", leaderCode: "000001", leaderName: "一号股份", stockCount: 3, value: 2 },
  { date: "2026-05-11", leaderCode: "000002", leaderName: "二号股份", stockCount: 5, value: 4 },
  { date: "2026-05-12", leaderCode: "000003", leaderName: "三号股份", stockCount: 8, value: 6 }
];

describe("HeightTrendChart", () => {
  it("renders a real line chart with date chips and active date marker", () => {
    const { container } = render(<HeightTrendChart activeDate="2026-05-11" items={items} onSelectDate={() => undefined} />);

    expect(screen.getByLabelText("连板高度折线图")).toBeInTheDocument();
    expect(container.querySelector(".height-trend-line")).toBeInTheDocument();
    expect(container.querySelector(".height-trend-area")).toBeInTheDocument();
    expect(container.querySelectorAll(".height-axis-value")).toHaveLength(5);
    expect(screen.getByText("最高 6 板")).toHaveClass("height-axis-value");
    expect(container.querySelectorAll(".height-trend-point")).toHaveLength(3);
    expect(screen.getByText("05-11").closest("button")).toHaveClass("active");
    expect(screen.getAllByText("二号股份").length).toBeGreaterThan(0);
  });

  it("selects the matching date from the chart date rail", async () => {
    const onSelectDate = vi.fn();

    render(<HeightTrendChart activeDate="2026-05-10" items={items} onSelectDate={onSelectDate} />);

    await userEvent.click(screen.getByRole("button", { name: "选择 2026-05-12 高度 6 板" }));

    expect(onSelectDate).toHaveBeenCalledWith("2026-05-12");
  });

  it("selects the matching date from the plotted curve point", async () => {
    const onSelectDate = vi.fn();

    render(<HeightTrendChart activeDate="2026-05-10" items={items} onSelectDate={onSelectDate} />);

    await userEvent.click(screen.getByRole("button", { name: "选择折线日期 2026-05-11 高度 4 板" }));

    expect(onSelectDate).toHaveBeenCalledWith("2026-05-11");
  });

  it("keeps a readable empty state without fake K-line data", () => {
    render(<HeightTrendChart activeDate="" items={[]} onSelectDate={() => undefined} />);

    expect(screen.getByText("暂无高度曲线")).toBeInTheDocument();
  });

  it("scrolls the date rail to the latest trading day by default", async () => {
    const originalScrollTo = Element.prototype.scrollTo;
    const scrollTo = vi.fn();
    Element.prototype.scrollTo = scrollTo;
    try {
      render(
        <HeightTrendChart
          activeDate="2026-05-12"
          items={Array.from({ length: 20 }, (_, index) => ({
            date: `2026-05-${String(index + 1).padStart(2, "0")}`,
            leaderCode: `0000${index}`,
            leaderName: `${index + 1}号股份`,
            stockCount: index + 1,
            value: (index % 6) + 2
          }))}
          onSelectDate={() => undefined}
        />
      );

      await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ left: expect.any(Number) })));
    } finally {
      Element.prototype.scrollTo = originalScrollTo;
    }
  });

  it("aligns date rail cells with plotted curve nodes and keeps the hit layer behind the visible line", () => {
    const { container } = render(<HeightTrendChart activeDate="2026-05-11" items={items} onSelectDate={() => undefined} />);

    expect(container.querySelector(".height-trend-scale")).toBeInTheDocument();
    expect(container.querySelector(".height-trend-plot .height-trend-scale > svg")).toBeInTheDocument();
    const rail = container.querySelector(".height-date-rail.height-trend-scale");
    expect(rail).toBeInTheDocument();
    expect(rail).toHaveStyle({ "--height-trend-count": "3" });
    expect(rail).toHaveStyle({ "--height-trend-left": "5.897435897435897%" });
    expect(rail).toHaveStyle({ "--height-trend-right": "4.358974358974359%" });
    const railButtons = Array.from(container.querySelectorAll(".height-date-rail button")) as HTMLElement[];
    expect(Number.parseFloat(railButtons[0].style.left)).toBeCloseTo(5.897, 2);
    expect(Number.parseFloat(railButtons[2].style.left)).toBeCloseTo(95.641, 2);
    expect(container.querySelector(".height-trend-hit-layer")).toHaveAttribute("data-layer", "below-line");
  });
});
