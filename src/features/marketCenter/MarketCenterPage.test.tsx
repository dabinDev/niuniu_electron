import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "../../app/preferencesStore";
import { MarketCenterPage } from "./MarketCenterPage";

const marketSnapshot = {
  market_center: {
    tables: [
      {
        columns: ["code", "name", "change_pct"],
        items: [{ change_pct: "+1.20%", code: "000001", name: "上证指数" }],
        key: "indices",
        title: "指数行情",
        total: "1"
      }
    ],
    trade_date: "2026-05-15"
  },
  navigation: {
    available_trade_dates: ["2026-05-14", "2026-05-15"],
    next_trade_date: null,
    previous_trade_date: "2026-05-14",
    resolved_trade_date: "2026-05-15"
  }
};

const yesterdaySnapshot = {
  fetched_at: "2026-05-15 15:01:00",
  sections: [
    {
      items: [{ amount_yi: "1.2", change_pct: "-3.2", code: "002001", industry: "软件", name: "空头样本", open_change_pct: "-1.1", region: "深圳" }],
      key: "today_limit_down",
      title: "today_limit_down",
      total: "1"
    }
  ],
  today_stats: { lb: 2, zb: 3, zt: 4 },
  trade_date: "2026-05-15",
  trade_dates: { current: "2026-05-15" },
  yesterday_stats: { dt: 1 }
};

describe("MarketCenterPage", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ apiBaseUrl: "http://api.test" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("combines market tables and short-side feedback under one shared date navigator", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/yesterday/stats")) return jsonResponse(yesterdaySnapshot);
      return jsonResponse(marketSnapshot);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderWithClient();

    expect(await screen.findByRole("button", { name: /行情表格/ })).toBeInTheDocument();
    expect(screen.getByText("空头反馈")).toBeInTheDocument();
    expect(container.querySelectorAll(".trade-date-nav")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /空头反馈 1/ }));

    expect(await screen.findByText("空头样本")).toBeInTheDocument();
    const table = container.querySelector(".market-center-panel .data-table");
    expect(table).toBeInTheDocument();
    expect(within(table as HTMLElement).getByText("-1.1%")).toBeInTheDocument();
    expect(within(table as HTMLElement).getByText("-3.2%")).toBeInTheDocument();
    expect(within(table as HTMLElement).getByText("-1.1%")).toHaveClass("change-cell", "text-down");
    expect(within(table as HTMLElement).getByText("-3.2%")).toHaveClass("change-cell", "text-down");
    expect(table?.querySelector(".data-row")).toHaveClass("row-down");
  });
});

function renderWithClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
  return render(
    <QueryClientProvider client={client}>
      <MarketCenterPage />
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}
