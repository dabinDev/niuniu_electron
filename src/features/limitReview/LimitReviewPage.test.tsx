import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "../../app/preferencesStore";
import { LimitReviewPage } from "./LimitReviewPage";

const snapshot = {
  ai_review: { enabled: true, analysis: "" },
  board_height: {
    chart_items: [
      { date: "2026-05-10", leader_code: "000001", leader_name: "一号股份", stock_count: 3, value: 2 },
      { date: "2026-05-11", leader_code: "000002", leader_name: "二号股份", stock_count: 4, value: 4 },
      { date: "2026-05-12", leader_code: "000003", leader_name: "三号股份", stock_count: 8, value: 6 }
    ],
    latest_height: 6
  },
  limit_review: {
    fetched_at: "2026-05-12 15:01:00",
    groups: [
      {
        columns: [{ key: "stock_code", label: "代码" }, { key: "stock_name", label: "名称" }, { key: "board_count", label: "连板数" }],
        count: 1,
        items: [{ board_count: 6, stock_code: "000003", stock_name: "三号股份" }],
        name: "6板"
      }
    ],
    max_board_height: 6,
    total_groups: 1,
    total_stocks: 1,
    trade_date: "2026-05-12"
  },
  navigation: {
    available_trade_dates: ["2026-05-12", "2026-05-11"],
    resolved_trade_date: "2026-05-12"
  },
  yesterday_stats: { sections: [] }
};

describe("LimitReviewPage", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ apiBaseUrl: "http://api.test" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a linked height line chart and posts AI review with client_config", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/ask-ai/client-config")) {
        return jsonResponse({ ok: true });
      }
      if (requestUrl.includes("/api/v1/limit-review/ai-review")) {
        return jsonResponse({ analysis: "AI 复盘完成", enabled: true });
      }
      return jsonResponse(snapshot);
    });
    localStorage.setItem("niuniu-ask-ai-settings", JSON.stringify({ apiKey: "kimi-key", model: "kimi-k2.6", dailyLimit: 0 }));
    localStorage.setItem("niuniu-ask-ai-client-id", "electron-test");
    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByLabelText("连板高度折线图")).toBeInTheDocument();
    expect(container.querySelector(".kline-chart")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "选择 2026-05-11 高度 4 板" }));
    expect(screen.getByTestId("review-height-active-date")).toHaveTextContent("2026-05-11");

    await user.click(screen.getByRole("button", { name: /生成|重新生成/ }));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/ask-ai/client-config"),
      expect.objectContaining({
        body: expect.stringContaining("kimi-key"),
        method: "POST"
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/limit-review/ai-review"),
      expect.objectContaining({
        body: expect.stringContaining("client_config"),
        method: "POST"
      })
    );
  }, 15000);

  it("uses the shared server quota to disable limit-review AI when exhausted", async () => {
    localStorage.setItem("niuniu-ask-ai-client-id", "electron-test");
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/ask-ai/usage-status")) {
        return jsonResponse({
          client_id: "electron-test",
          features: { limit_review: { limit: 3, remaining: 0, used: 3 } },
          has_own_key: false
        });
      }
      return jsonResponse(snapshot);
    });
    renderWithClient(fetchMock);

    const button = await screen.findByRole("button", { name: /今日额度已用完/ });
    expect(button).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/ask-ai/usage-status"),
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("usage-status?client_id="),
      expect.anything()
    );
  });

  it("limits the embedded height review chart to the latest 20 days", async () => {
    const longSnapshot = {
      ...snapshot,
      board_height: {
        ...snapshot.board_height,
        chart_items: Array.from({ length: 25 }, (_, index) => ({
          date: `2026-04-${String(index + 1).padStart(2, "0")}`,
          leader_code: `0000${index}`,
          leader_name: `${index + 1}号股份`,
          stock_count: index + 1,
          value: (index % 7) + 1
        })),
        columns: Array.from({ length: 25 }, (_, index) => ({
          date: `2026-04-${String(index + 1).padStart(2, "0")}`,
          stocks: [{ board_count: (index % 7) + 1, code: `0000${index}`, name: `${index + 1}号股份` }]
        }))
      },
      limit_review: {
        ...snapshot.limit_review,
        trade_date: "2026-04-25"
      }
    };
    const fetchMock = vi.fn(async () => jsonResponse(longSnapshot));
    renderWithClient(fetchMock);

    expect(await screen.findByLabelText("连板高度折线图")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "选择 2026-04-01 高度 1 板" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "选择 2026-04-25 高度 4 板" })).toBeInTheDocument();
  });

  it("translates yesterday feedback section keys instead of exposing backend identifiers", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ...snapshot,
      yesterday_stats: {
        sections: [
          { key: "yesterday_limit_down", total: 2, items: [{ code: "000001", name: "一号股份" }] },
          { key: "today_broken_board", total: 11, items: [{ code: "000002", name: "二号股份" }] }
        ]
      }
    }));

    renderWithClient(fetchMock);

    expect(await screen.findByText("昨日跌停反馈")).toBeInTheDocument();
    expect(screen.getByText("今日炸板")).toBeInTheDocument();
    expect(screen.queryByText("yesterday_limit_down")).not.toBeInTheDocument();
    expect(screen.queryByText("today_broken_board")).not.toBeInTheDocument();
  });

  it("uses Chinese review table headers even when backend labels are English keys", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ...snapshot,
      limit_review: {
        ...snapshot.limit_review,
        groups: [
          {
            columns: [
              { key: "stock_name", label: "stock_name" },
              { key: "final_limit_time", label: "Final Limit Time" },
              { key: "float_market_cap_yi", label: "Float Market Cap Yi" }
            ],
            count: 1,
            items: [{ final_limit_time: "09:45", float_market_cap_yi: "42亿", stock_name: "三号股份" }],
            name: "首板"
          }
        ]
      }
    }));

    renderWithClient(fetchMock);

    expect(await screen.findByText("名称")).toBeInTheDocument();
    expect(screen.getByText("最终封板")).toBeInTheDocument();
    expect(screen.getByText("实际流通")).toBeInTheDocument();
    expect(screen.queryByText("stock_name")).not.toBeInTheDocument();
    expect(screen.queryByText("Final Limit Time")).not.toBeInTheDocument();
  });

  it("localizes backend review group keys before rendering tabs and card titles", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ...snapshot,
      limit_review: {
        ...snapshot.limit_review,
        groups: [
          {
            columns: [{ key: "stock_code", label: "stock_code" }, { key: "stock_name", label: "stock_name" }],
            count: 1,
            items: [{ stock_code: "000001", stock_name: "一号股份" }],
            name: "first_board"
          },
          {
            columns: [{ key: "stock_code", label: "stock_code" }, { key: "stock_name", label: "stock_name" }],
            count: 1,
            items: [{ stock_code: "000002", stock_name: "二号股份" }],
            name: "limit_up_pool"
          }
        ]
      }
    }));

    renderWithClient(fetchMock);

    expect(await screen.findByRole("button", { name: /首板 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /涨停池 1/ })).toBeInTheDocument();
    expect(screen.queryByText("first_board")).not.toBeInTheDocument();
    expect(screen.queryByText("limit_up_pool")).not.toBeInTheDocument();
  });

  it("separates lianban and first-board review data into compact subtabs without dropping change percent", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => jsonResponse({
      ...snapshot,
      limit_review: {
        ...snapshot.limit_review,
        groups: [
          {
            columns: [{ key: "stock_code", label: "代码" }, { key: "stock_name", label: "名称" }, { key: "board_count", label: "连板数" }],
            count: 1,
            items: [{ board_count: 3, change_pct: "+10.01%", latest_price: "12.34", stock_code: "000001", stock_name: "连板股份" }],
            name: "3板"
          },
          {
            columns: [{ key: "stock_code", label: "代码" }, { key: "stock_name", label: "名称" }, { key: "first_limit_time", label: "首封" }],
            count: 2,
            items: [
              { change_pct: "+9.98%", first_limit_time: "09:35", latest_price: "8.88", stock_code: "000002", stock_name: "首板股份" },
              { change_pct: "+10.00%", first_limit_time: "10:12", latest_price: "6.66", stock_code: "000003", stock_name: "首板二号" }
            ],
            name: "first_board"
          }
        ],
        total_groups: 2,
        total_stocks: 3
      }
    }));

    const { container } = renderWithClient(fetchMock);

    const workspace = await screen.findByTestId("review-groups-workspace");
    expect(workspace).toHaveClass("review-groups-workspace");
    expect(within(workspace).getByRole("button", { name: /连板 1/ })).toHaveAttribute("aria-selected", "true");
    expect(within(workspace).getByRole("button", { name: /首板 2/ })).toBeInTheDocument();
    expect(screen.getByText("连板股份")).toBeInTheDocument();
    expect(screen.getByText("+10.01%")).toHaveClass("change-cell", "text-up");
    expect(screen.getByText("涨跌幅")).toBeInTheDocument();
    expect(container.querySelector(".review-board-group-list")).toBeInTheDocument();
    expect(container.querySelector(".review-board-group-list details")).not.toBeInTheDocument();

    await user.click(within(workspace).getByRole("button", { name: /首板 2/ }));

    expect(screen.getByText("首板股份")).toBeInTheDocument();
    expect(screen.getByText("首板二号")).toBeInTheDocument();
    expect(screen.getByText("+9.98%")).toHaveClass("change-cell", "text-up");
    expect(container.querySelector(".review-groups-panel .data-table")).toBeInTheDocument();
  }, 15000);

  it("keeps the review workbench wide enough for change percent and local horizontal scrolling", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ...snapshot,
      limit_review: {
        ...snapshot.limit_review,
        groups: [
          {
            columns: [
              { key: "stock_code", label: "代码" },
              { key: "stock_name", label: "名称" },
              { key: "change_pct", label: "涨幅" },
              { key: "latest_price", label: "现价" },
              { key: "board_count", label: "连板数" },
              { key: "first_limit_time", label: "首封" },
              { key: "final_limit_time", label: "封板" },
              { key: "amount_yi", label: "成交额" },
              { key: "float_market_cap_yi", label: "流通市值" },
              { key: "reason", label: "原因" }
            ],
            count: 1,
            items: [{
              amount_yi: "12.8",
              board_count: 2,
              change_pct: "+10.02%",
              final_limit_time: "14:55",
              first_limit_time: "09:32",
              float_market_cap_yi: "86.4",
              latest_price: "12.34",
              reason: "AI 端侧算力",
              stock_code: "000001",
              stock_name: "横向股份"
            }],
            name: "2板"
          }
        ]
      }
    }));

    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByText("横向股份")).toBeInTheDocument();
    expect(screen.getByText("+10.02%")).toHaveClass("change-cell", "text-up");
    expect(container.querySelector(".limit-review-workbench")).toBeInTheDocument();
    expect(container.querySelector(".limit-review-ai-panel .ai-card")).toBeInTheDocument();
    expect(container.querySelector(".review-groups-panel .data-table")).toBeInTheDocument();

    const css = readProjectCss();
    expect(css).toMatch(/\.limit-review-workbench\s*\{[\s\S]*grid-template-columns:\s*minmax\(720px,\s*1fr\)\s*minmax\(260px,\s*\.30fr\)/);
    expect(css).toMatch(/\.review-groups-panel\s+\.data-table\s*\{[\s\S]*overflow-x:\s*auto/);
    expect(css).toMatch(/\.review-groups-panel\s+\.data-table-head,\s*\.review-groups-panel\s+\.data-row\s*\{[\s\S]*min-width:\s*max\(100%,\s*980px\)/);
    expect(css).toMatch(/\.review-mode-tabs button\s*\{[\s\S]*min-height:\s*40px/);
    expect(css).toMatch(/\.review-board-group-list button\s*\{[\s\S]*min-height:\s*44px/);
  });

  it("formats numeric change_pct values and avoids duplicate stock identity columns in review groups", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ...snapshot,
      limit_review: {
        ...snapshot.limit_review,
        groups: [
          {
            columns: [
              { key: "stock_code", label: "代码" },
              { key: "stock_name", label: "名称" },
              { key: "code", label: "代码" },
              { key: "name", label: "名称" },
              { key: "board_count", label: "连板数" }
            ],
            count: 1,
            items: [{
              board_count: 4,
              change_pct: 10.01,
              code: "000001",
              name: "重复名称",
              stock_code: "000004",
              stock_name: "数值涨幅"
            }],
            name: "4板"
          }
        ],
        total_groups: 1,
        total_stocks: 1
      }
    }));

    const { container } = renderWithClient(fetchMock);

    await screen.findByText("数值涨幅");
    expect(screen.getByText("+10.01%")).toHaveClass("change-cell", "text-up");
    expect(container.querySelectorAll(".review-groups-panel .data-table-head .cell")).toHaveLength(3);
    expect(container.querySelector(".review-groups-panel .data-table-head")).toHaveTextContent("股票");
    expect(container.querySelector(".review-groups-panel .data-table-head")).toHaveTextContent("涨跌幅");
    expect(container.querySelector(".review-groups-panel .data-table-head")).toHaveTextContent("连板数");
    expect(screen.queryByText("重复名称")).not.toBeInTheDocument();
  });
});

function renderWithClient(fetchMock: typeof fetch) {
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
  return render(
    <QueryClientProvider client={client}>
      <LimitReviewPage />
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}

function readProjectCss() {
  return readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
}
