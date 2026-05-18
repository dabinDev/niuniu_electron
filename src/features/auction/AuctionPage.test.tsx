import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "../../app/preferencesStore";
import { AuctionPage } from "./AuctionPage";

const snapshot = {
  ai_analysis: { enabled: true, analysis: "" },
  fetched_at: "2026-05-14 09:31:00",
  history_columns: [],
  rank_sections: [],
  trade_date: "2026-05-14"
};

describe("AuctionPage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("niuniu-ask-ai-client-id", "electron-test");
    usePreferencesStore.setState({ apiBaseUrl: "http://api.test" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the shared server quota to disable the auction AI feature when exhausted", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/ask-ai/usage-status")) {
        return jsonResponse({
          client_id: "electron-test",
          features: { auction: { limit: 3, remaining: 0, used: 3 } },
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

  it("shows percent units for stock change values in history columns", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/ask-ai/usage-status")) {
        return jsonResponse({ client_id: "electron-test", features: { auction: { limit: 3, remaining: 3, used: 0 } } });
      }
      return jsonResponse({
        ...snapshot,
        history_columns: [
          {
            items: [{
              amounts: ["9:15 1.2亿", "9:20 1.6亿", "9:25 2.0亿"],
              code: "000001",
              concepts: "算力",
              lianban: "2板",
              name: "一号股份",
              zhangfu: "9.98"
            }],
            title: "今日竞价",
            total: 1,
            trade_date: "2026-05-14"
          }
        ]
      });
    });

    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByText("一号股份")).toBeInTheDocument();
    const stockCard = container.querySelector(".auction-stock-list article");
    expect(stockCard).toBeInTheDocument();
    expect(within(stockCard as HTMLElement).getAllByText(/9\.98%/)).toHaveLength(2);
    expect(within(stockCard as HTMLElement).getByText("9:15")).toBeInTheDocument();
    expect(within(stockCard as HTMLElement).getByText("1.2亿")).toBeInTheDocument();
    expect(within(stockCard as HTMLElement).getByText("9:20")).toBeInTheDocument();
    expect(within(stockCard as HTMLElement).getByText("1.6亿")).toBeInTheDocument();
    expect(within(stockCard as HTMLElement).getByText("9:25")).toBeInTheDocument();
    expect(within(stockCard as HTMLElement).getByText("2.0亿")).toBeInTheDocument();
  });

  it("maps real auction amount arrays to their column time labels", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/ask-ai/usage-status")) {
        return jsonResponse({ client_id: "electron-test", features: { auction: { limit: 3, remaining: 3, used: 0 } } });
      }
      return jsonResponse({
        ...snapshot,
        history_columns: [
          {
            items: [{
              amounts: ["122.3亿", "27.3亿", "27.4亿"],
              code: "603779",
              concepts: ["酿酒"],
              lianban: "4板",
              name: "威龙股份",
              zhangfu: "9.98%"
            }],
            time_labels: ["9:15", "9:20", "9:25", "涨幅"],
            title: "今日竞价",
            total: 1,
            trade_date: "2026-05-18"
          }
        ]
      });
    });

    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByText("威龙股份")).toBeInTheDocument();
    const stockCard = container.querySelector(".auction-stock-list article");
    expect(stockCard).toBeInTheDocument();
    expect(within(stockCard as HTMLElement).getByText("9:15")).toBeInTheDocument();
    expect(within(stockCard as HTMLElement).getByText("122.3亿")).toBeInTheDocument();
    expect(within(stockCard as HTMLElement).getByText("9:20")).toBeInTheDocument();
    expect(within(stockCard as HTMLElement).getByText("27.3亿")).toBeInTheDocument();
    expect(within(stockCard as HTMLElement).getByText("9:25")).toBeInTheDocument();
    expect(within(stockCard as HTMLElement).getByText("27.4亿")).toBeInTheDocument();
    const timeline = stockCard?.querySelector(".auction-amount-timeline");
    expect(timeline).toBeInTheDocument();
    expect(timeline?.querySelectorAll(".auction-amount-point")).toHaveLength(4);
    expect(within(timeline as HTMLElement).getByText("涨幅")).toBeInTheDocument();
    expect(within(timeline as HTMLElement).getByText("9.98%")).toBeInTheDocument();
  });

  it("marks the same selected stock across auction history columns", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/ask-ai/usage-status")) {
        return jsonResponse({ client_id: "electron-test", features: { auction: { limit: 3, remaining: 3, used: 0 } } });
      }
      return jsonResponse({
        ...snapshot,
        history_columns: [
          {
            items: [
              { amounts: ["1.2亿", "1.6亿", "2.0亿"], code: "600000", concepts: ["机器人"], lianban: "2板", name: "浦发A", zhangfu: "+5.20%" },
              { amounts: ["0.5亿", "0.7亿", "0.9亿"], code: "000001", concepts: ["金融"], lianban: "首板", name: "对照股", zhangfu: "+2.10%" }
            ],
            time_labels: ["9:15", "9:20", "9:25", "涨幅"],
            title: "今日竞价",
            total: 2,
            trade_date: "2026-05-18"
          },
          {
            items: [
              { amounts: ["0.8亿", "1.1亿", "1.4亿"], code: "600000", concepts: ["机器人"], lianban: "首板", name: "浦发A", zhangfu: "+3.40%" }
            ],
            time_labels: ["9:15", "9:20", "9:25", "涨幅"],
            title: "昨日竞价",
            total: 1,
            trade_date: "2026-05-17"
          }
        ]
      });
    });

    const { container } = renderWithClient(fetchMock);

    expect(await screen.findAllByText("浦发A")).toHaveLength(2);
    const matchingCards = container.querySelectorAll(".auction-stock-list article[data-stock-code='600000']");
    expect(matchingCards).toHaveLength(2);

    fireEvent.click(matchingCards[0]);

    matchingCards.forEach((card) => {
      expect(card).toHaveClass("same-stock");
      expect(within(card as HTMLElement).getByText("同股")).toBeInTheDocument();
    });
    const otherCard = container.querySelector(".auction-stock-list article[data-stock-code='000001']");
    expect(otherCard).not.toHaveClass("same-stock");
    expect(within(otherCard as HTMLElement).queryByText("同股")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/v1/stocks/600000/profile"), expect.anything());
  });

  it("opens the stock profile from auction history only on double click", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/ask-ai/usage-status")) {
        return jsonResponse({ client_id: "electron-test", features: { auction: { limit: 3, remaining: 3, used: 0 } } });
      }
      if (requestUrl.includes("/api/v1/stocks/600000/profile")) {
        return jsonResponse({ code: "600000", industry_name: "bank", name: "profile-name" });
      }
      if (requestUrl.includes("/api/v1/stocks/600000/quote")) {
        return jsonResponse({ change_pct: 5.2, price: 12.34, turnover_rate: 3.1 });
      }
      if (requestUrl.includes("/api/v1/stocks/600000/kline")) {
        return jsonResponse({ bars: [] });
      }
      return jsonResponse({
        ...snapshot,
        history_columns: [
          {
            items: [{ amounts: ["1.2亿", "1.6亿", "2.0亿"], code: "600000", concepts: ["机器人"], lianban: "2板", name: "单击股", zhangfu: "+5.20%" }],
            time_labels: ["9:15", "9:20", "9:25", "涨幅"],
            title: "今日竞价",
            total: 1,
            trade_date: "2026-05-18"
          }
        ]
      });
    });

    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByText("单击股")).toBeInTheDocument();
    const stockCard = container.querySelector(".auction-stock-list article[data-stock-code='600000']");
    expect(stockCard).toBeInTheDocument();

    fireEvent.click(stockCard as HTMLElement);
    await nextTick();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/v1/stocks/600000/profile"), expect.anything());

    fireEvent.dblClick(stockCard as HTMLElement);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/v1/stocks/600000/profile"), expect.anything()));
  });

  it("shows percent units for bid and current change values in the rank list", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/ask-ai/usage-status")) {
        return jsonResponse({ client_id: "electron-test", features: { auction: { limit: 3, remaining: 3, used: 0 } } });
      }
      return jsonResponse({
        ...snapshot,
        rank_sections: [
          {
            items: [{ action: "limit by backend", bid_amount_wan: "1234.5", bid_change_pct: "4.32", board_text: "2板", code: "000002", concept: "机器人", current_change_pct: "8.76", name: "浜屽彿鑲′唤" }],
            key: "hot",
            title: "寮哄娍绔炰环",
            total: 1
          }
        ]
      });
    });

    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByText("浜屽彿鑲′唤")).toBeInTheDocument();
    const list = container.querySelector(".auction-rank-list");
    expect(list).toBeInTheDocument();
    expect(within(list as HTMLElement).getByText("4.32%")).toBeInTheDocument();
    expect(within(list as HTMLElement).getByText("8.76%")).toBeInTheDocument();
    expect(within(list as HTMLElement).getByText("1,234.5万")).toBeInTheDocument();
    expect(within(list as HTMLElement).queryByText(/limit by/i)).not.toBeInTheDocument();
  });

  it("keeps auction amount values from inheriting stock-name ellipsis styles", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

    expect(css).toMatch(/\.auction-stock-list article > b\s*\{[\s\S]*text-overflow:\s*ellipsis/);
    expect(css).not.toMatch(/\.auction-stock-list b\s*\{/);
    expect(css).toMatch(/\.auction-amount-timeline b\s*\{[\s\S]*padding:\s*0;[\s\S]*overflow:\s*visible;[\s\S]*text-overflow:\s*clip/);
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
      <AuctionPage />
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}

function nextTick() {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}
