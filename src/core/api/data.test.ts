import { describe, expect, it } from "vitest";
import { columnLabel, recordListToTable, toColumns } from "./data";

describe("table data helpers", () => {
  it("translates backend field keys into Chinese labels instead of title-cased English", () => {
    expect(columnLabel("rank_no")).toBe("排名");
    expect(columnLabel("stock_limit")).toBe("股票上限");
    expect(columnLabel("bid_change_pct")).toBe("竞价涨幅");
    expect(columnLabel("success_rate_text")).toBe("成功率");
    expect(columnLabel("run_id")).toBe("运行编号");
    expect(columnLabel("job_code")).toBe("任务代码");
  });

  it("keeps strength and limit-up count as separate semantic columns", () => {
    const table = recordListToTable(
      [{ plate_name: "算力", strength: 9.8, zt_count: 5 }],
      ["plate_name", "strength", "zt_count"]
    );

    expect(table.columns.map((column) => column.label)).toEqual(["板块", "强度", "涨停数"]);
  });

  it("uses readable Chinese labels for risk section keys and unknown backend keys", () => {
    expect(columnLabel("yesterday_limit_down")).toBe("昨日跌停反馈");
    expect(columnLabel("today_broken_board")).toBe("今日炸板");
    expect(columnLabel("custom_backend_key")).toBe("自定义后端字段");
  });

  it("translates review and market backend column keys that appear in API table definitions", () => {
    expect(columnLabel("pre_close_price")).toBe("昨收价");
    expect(columnLabel("final_limit_time")).toBe("最终封板");
    expect(columnLabel("float_market_cap_yi")).toBe("实际流通");
    expect(columnLabel("lianban_text")).toBe("连板");
    expect(columnLabel("open_change_pct")).toBe("开盘涨幅");
  });

  it("prefers Chinese labels when backend column definitions carry English labels", () => {
    const columns = toColumns({
      column_defs: [
        { key: "stock_name", label: "stock_name" },
        { key: "final_limit_time", label: "Final Limit Time" },
        { key: "float_market_cap_yi", label: "Float Market Cap Yi" }
      ]
    });

    expect(columns.map((column) => column.label)).toEqual(["名称", "最终封板", "实际流通"]);
  });
});
