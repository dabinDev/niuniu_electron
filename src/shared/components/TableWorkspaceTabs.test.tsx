import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TableWorkspaceTabs } from "./TableWorkspaceTabs";

const sections = [
  {
    key: "limit",
    title: "涨停池",
    total: "2",
    columns: ["code", "name", "change_pct"],
    items: [
      { code: "000001", name: "平安银行", change_pct: "+10.01%" },
      { code: "000002", name: "万科A", change_pct: "+9.88%" }
    ]
  },
  {
    key: "broken",
    title: "炸板池",
    total: "1",
    columns: ["code", "name", "change_pct"],
    items: [{ code: "300001", name: "特锐德", change_pct: "-2.01%" }]
  }
];

describe("TableWorkspaceTabs", () => {
  it("renders only the active section and switches table content", async () => {
    const user = userEvent.setup();

    render(<TableWorkspaceTabs sections={sections} />);

    expect(screen.getByRole("button", { name: /涨停池 2/ })).toHaveClass("on");
    expect(screen.getByText("平安银行")).toBeInTheDocument();
    expect(screen.queryByText("特锐德")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /炸板池 1/ }));

    expect(screen.getByText("特锐德")).toBeInTheDocument();
    expect(screen.queryByText("平安银行")).not.toBeInTheDocument();
  });

  it("shows a compact summary for pool coverage", () => {
    render(<TableWorkspaceTabs sections={sections} />);

    expect(screen.getByText("股池工作台")).toBeInTheDocument();
    expect(screen.getByText("股池").closest(".summary-metric")).toHaveTextContent("2");
    expect(screen.getByText("总样本").closest(".summary-metric")).toHaveTextContent("3");
  });
});
