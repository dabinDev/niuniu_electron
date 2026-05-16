import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders description, action and hint when provided", () => {
    render(
      <EmptyState
        action="刷新接口"
        description="当前交易日还没有返回龙虎榜候选。"
        hint="最近一次有效数据：2026-05-13"
        title="暂无候选股"
        tone="market"
      />
    );

    expect(screen.getByText("暂无候选股")).toBeInTheDocument();
    expect(screen.getByText("当前交易日还没有返回龙虎榜候选。")).toBeInTheDocument();
    expect(screen.getByText("刷新接口")).toHaveClass("empty-state-action");
    expect(screen.getByText("最近一次有效数据：2026-05-13")).toHaveClass("empty-state-hint");
  });
});
