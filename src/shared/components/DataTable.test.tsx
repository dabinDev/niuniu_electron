import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable } from "./DataTable";

describe("DataTable", () => {
  it("renders columns and rows with red positive and green negative values", () => {
    const { container } = render(
      <DataTable
        columns={[
          { key: "name", label: "名称", align: "left" },
          { key: "change_pct", label: "涨跌幅", align: "right", tone: "change" }
        ]}
        rows={[
          { id: "1", values: { name: "东方财富", change_pct: "+5.39%" } },
          { id: "2", values: { name: "药明康德", change_pct: "-1.72%" } }
        ]}
      />
    );

    expect(screen.getByText("名称")).toBeInTheDocument();
    expect(screen.getByText("东方财富")).toBeInTheDocument();
    expect(screen.getByText("+5.39%")).toHaveClass("change-cell", "text-up");
    expect(screen.getByText("-1.72%")).toHaveClass("change-cell", "text-down");
    const rows = container.querySelectorAll(".data-row");
    expect(rows[0]).toHaveClass("row-up");
    expect(rows[1]).toHaveClass("row-down");
  });

  it("renders stock identity as a two-line market cell", () => {
    const { container } = render(
      <DataTable
        columns={[
          { key: "stock", label: "股票", variant: "stock" },
          { key: "change_pct", label: "涨跌幅", align: "right", tone: "change" }
        ]}
        rows={[
          {
            id: "1",
            values: {
              code: "300059",
              name: "东方财富",
              change_pct: "+5.39%"
            }
          }
        ]}
      />
    );

    expect(screen.getByText("300059")).toHaveClass("stock-code");
    expect(screen.getByText("东方财富")).toHaveClass("stock-name");
    expect(container.querySelector(".data-table")).toHaveStyle({
      "--table-template": "minmax(176px, 1.25fr) minmax(112px, .88fr)"
    });
    expect(screen.getByText("东方财富").closest(".stock-cell")).toHaveAttribute("title", "300059 东方财富");
  });

  it("collapses duplicate stock identity pairs into a single stock column", () => {
    const { container } = render(
      <DataTable
        columns={[
          { key: "stock_code", label: "代码", variant: "stock" },
          { key: "stock_name", label: "名称", variant: "stock" },
          { key: "code", label: "代码", variant: "stock" },
          { key: "name", label: "名称", variant: "stock" },
          { key: "change_pct", label: "涨幅", align: "right", tone: "change", variant: "change" }
        ]}
        rows={[
          {
            id: "1",
            values: {
              change_pct: "+10.01%",
              code: "000001",
              name: "备用名称",
              stock_code: "300059",
              stock_name: "东方财富"
            }
          }
        ]}
      />
    );

    expect(container.querySelectorAll(".data-table-head .cell")).toHaveLength(2);
    expect(container.querySelector(".data-table-head")).toHaveTextContent("股票");
    expect(container.querySelector(".data-table-head")).toHaveTextContent("涨幅");
    expect(screen.getByText("300059")).toHaveClass("stock-code");
    expect(screen.getByText("东方财富")).toHaveClass("stock-name");
    expect(screen.queryByText("备用名称")).not.toBeInTheDocument();
  });

  it("renders semantic status chips for market states", () => {
    render(
      <DataTable
        columns={[
          { key: "name", label: "名称" },
          { key: "status", label: "状态", variant: "status" }
        ]}
        rows={[
          { id: "1", values: { name: "高位板", status: "封板" } },
          { id: "2", values: { name: "弱转强", status: "炸板" } }
        ]}
      />
    );

    expect(screen.getByText("封板")).toHaveClass("status-chip", "status-up");
    expect(screen.getByText("炸板")).toHaveClass("status-chip", "status-down");
  });

  it("renders boolean status values as Chinese chips while keeping status tone", () => {
    render(
      <DataTable
        columns={[
          { key: "name", label: "名称" },
          { key: "enabled", label: "启用", variant: "status" }
        ]}
        rows={[
          { id: "1", values: { name: "任务 A", enabled: "true" } },
          { id: "2", values: { name: "任务 B", enabled: "false" } }
        ]}
      />
    );

    expect(screen.getByText("是")).toHaveClass("status-chip", "status-up");
    expect(screen.getByText("否")).toHaveClass("status-chip", "status-down");
  });

  it("does not classify broken market status as a positive ok status", () => {
    render(
      <DataTable
        columns={[
          { key: "name", label: "名称" },
          { key: "status", label: "状态", variant: "status" }
        ]}
        rows={[{ id: "1", values: { name: "炸板样本", status: "broken" } }]}
      />
    );

    expect(screen.getByText("炸板")).toHaveClass("status-chip", "status-down");
  });

  it("marks row density so tables can reserve readable height", () => {
    const { container } = render(
      <DataTable
        columns={[{ key: "name", label: "名称" }]}
        rows={[
          { id: "1", values: { name: "一号股份" } },
          { id: "2", values: { name: "二号股份" } },
          { id: "3", values: { name: "三号股份" } }
        ]}
      />
    );

    expect(container.querySelector(".data-table")).toHaveClass("rows-3");
  });

  it("marks sparse and dense tables separately for layout sizing", () => {
    const sparse = render(
      <DataTable
        columns={[{ key: "name", label: "名称" }]}
        rows={[{ id: "1", values: { name: "一号股份" } }]}
      />
    );

    expect(sparse.container.querySelector(".data-table")).toHaveClass("rows-1", "density-sparse");
    sparse.unmount();

    const dense = render(
      <DataTable
        columns={[{ key: "name", label: "名称" }]}
        rows={Array.from({ length: 14 }, (_, index) => ({ id: String(index), values: { name: `${index + 1}号股份` } }))}
      />
    );

    expect(dense.container.querySelector(".data-table")).toHaveClass("rows-12", "density-dense");
  });
});
