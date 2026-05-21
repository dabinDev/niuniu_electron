import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "../../app/preferencesStore";
import { BoardTierPage } from "./BoardTierPage";

const snapshot = {
  available_trade_dates: ["2026-05-14", "2026-05-13"],
  fetched_at: "2026-05-14 15:01:00",
  next_trade_date: null,
  previous_trade_date: "2026-05-13",
  tiers: [
    {
      broken_count: 1,
      sealed_count: 3,
      stocks: [
        { amount: "4.2亿", change_pct: "+10.01%", code: "000001", first_limit_time: "09:35", latest_price: "12.34", name: "一号股份", reason: "算力", status: "sealed" },
        { amount: "2.8亿", change_pct: "+9.98%", code: "000002", first_limit_time: "10:12", latest_price: "8.88", name: "二号股份", reason: "芯片", status: "broken" }
      ],
      success_rate_text: "75%",
      title: "4板"
    }
  ],
  total_stocks: 2,
  total_tiers: 1,
  trade_date: "2026-05-14"
};

const previousSnapshot = {
  ...snapshot,
  fetched_at: "2026-05-13 15:01:00",
  next_trade_date: "2026-05-14",
  previous_trade_date: "2026-05-12",
  tiers: [
    {
      broken_count: 0,
      sealed_count: 2,
      stocks: [
        { amount: "3.1亿", change_pct: "+10.00%", code: "000009", first_limit_time: "09:40", latest_price: "9.99", name: "九号股份", reason: "机器人", status: "sealed" }
      ],
      success_rate_text: "100%",
      title: "3板"
    }
  ],
  total_stocks: 1,
  total_tiers: 1,
  trade_date: "2026-05-13"
};

describe("BoardTierPage", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ apiBaseUrl: "http://api.test" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a structured tier summary before the stock table", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(snapshot));
    const { container } = renderWithClient(fetchMock);

    expect(await screen.findAllByText("4板")).not.toHaveLength(0);
    const summary = container.querySelector(".tier-summary-grid");
    expect(summary).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText("封板")).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText("炸板")).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText("成功率")).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText("样本")).toBeInTheDocument();
  });

  it("loads the previous trading day and renders a left-right ladder comparison", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("trade_date=2026-05-13")) return jsonResponse(previousSnapshot);
      return jsonResponse(snapshot);
    });
    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByTestId("board-tier-compare")).toBeInTheDocument();
    expect((await screen.findAllByText("九号股份")).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/lianban/tiers?stock_limit=40&tier_limit=12&trade_date=2026-05-13"),
      expect.objectContaining({ method: "GET" })
    );
    expect(screen.getByText("上个交易日")).toBeInTheDocument();
    expect(screen.getByText("当前交易日")).toBeInTheDocument();
    expect(screen.getByTestId("board-tier-lane-previous")).toHaveTextContent("2026-05-13");
    expect(screen.getByTestId("board-tier-lane-current")).toHaveTextContent("2026-05-14");
    expect(container.querySelectorAll(".tier-tree-card:not(.empty)")).toHaveLength(2);
  });

  it("aligns yesterday and today tiers on a shared tree trunk by board height", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("trade_date=2026-05-13")) return jsonResponse(previousSnapshot);
      return jsonResponse(snapshot);
    });
    const { container } = renderWithClient(fetchMock);

    const tree = await screen.findByTestId("board-tier-tree");
    expect(tree).toHaveClass("tier-tree-workspace");
    expect(tree.querySelector(".tier-tree-lane.previous")).toBeInTheDocument();
    expect(tree.querySelector(".tier-tree-trunk")).toBeInTheDocument();
    expect(tree.querySelector(".tier-tree-lane.current")).toBeInTheDocument();
    expect(await screen.findByText("九号股份")).toBeInTheDocument();
    expect(screen.getByTestId("tier-tree-row-4")).toHaveTextContent("4板");
    expect(screen.getByTestId("tier-tree-row-3")).toHaveTextContent("3板");
    expect(screen.getByTestId("tier-tree-row-4").querySelector(".tier-tree-card.current")).toHaveTextContent("一号股份");
    expect(screen.getByTestId("tier-tree-row-3").querySelector(".tier-tree-card.previous")).toHaveTextContent("九号股份");
    expect(container.querySelectorAll(".tier-compare-card")).toHaveLength(0);
  });

  it("translates raw stock status codes in the fullscreen tree list", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("trade_date=2026-05-13")) return jsonResponse(previousSnapshot);
      return jsonResponse(snapshot);
    });
    renderWithClient(fetchMock);

    const tree = await screen.findByTestId("board-tier-tree");

    expect(tree).toHaveTextContent("封板");
    expect(tree).toHaveTextContent("炸板");
    expect(tree).not.toHaveTextContent("sealed");
    expect(tree).not.toHaveTextContent("broken");
  });

  it("keeps the wide tier tree horizontally scrollable inside the tree workspace", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

    expect(css).toMatch(/\.page-scroll\s+\.tier-tree-workspace\s*\{[\s\S]*overflow:\s*auto\s*!important/);
    expect(css).toMatch(/\.page-scroll\s+\.tier-tree-rows\s*\{[\s\S]*overflow-x:\s*hidden\s*!important/);
    expect(css).toMatch(/\.page-scroll\s+\.tier-tree-header,[\s\S]*\.page-scroll\s+\.tier-tree-row\s*\{[\s\S]*min-width:\s*920px\s*!important/);
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
      <BoardTierPage />
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}
