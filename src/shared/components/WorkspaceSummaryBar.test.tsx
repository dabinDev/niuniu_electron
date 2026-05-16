import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceSummaryBar } from "./WorkspaceSummaryBar";

describe("WorkspaceSummaryBar", () => {
  it("renders summary metrics with tone classes and detail text", () => {
    render(
      <WorkspaceSummaryBar
        detail="交易日 2026-05-14"
        items={[
          { label: "股池", value: "6" },
          { label: "涨停", value: "42", tone: "up" },
          { label: "炸板", value: "8", tone: "down" }
        ]}
        title="行情工作台摘要"
      />
    );

    expect(screen.getByText("行情工作台摘要")).toBeInTheDocument();
    expect(screen.getByText("交易日 2026-05-14")).toBeInTheDocument();
    expect(screen.getByText("42").closest(".summary-metric")).toHaveClass("tone-up");
    expect(screen.getByText("8").closest(".summary-metric")).toHaveClass("tone-down");
  });

  it("renders the action slot", () => {
    render(
      <WorkspaceSummaryBar
        actions={<button type="button">刷新</button>}
        items={[{ label: "总数", value: 12 }]}
      />
    );

    expect(screen.getByRole("button", { name: "刷新" })).toBeInTheDocument();
  });
});
