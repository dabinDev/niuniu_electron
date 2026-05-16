import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
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
      expect.stringContaining("/api/v1/ask-ai/usage-status?client_id=electron-test"),
      expect.objectContaining({ method: "GET" })
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
            items: [{ code: "000001", concepts: "算力", lianban: "2板", name: "一号股份", zhangfu: "9.98" }],
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
    expect(within(stockCard as HTMLElement).getByText(/9\.98%/)).toBeInTheDocument();
  });

  it("shows percent units for bid and current change columns in rank tables", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/ask-ai/usage-status")) {
        return jsonResponse({ client_id: "electron-test", features: { auction: { limit: 3, remaining: 3, used: 0 } } });
      }
      return jsonResponse({
        ...snapshot,
        rank_sections: [
          {
            items: [{ bid_change_pct: "4.32", code: "000002", current_change_pct: "8.76", name: "浜屽彿鑲′唤" }],
            key: "hot",
            title: "寮哄娍绔炰环",
            total: 1
          }
        ]
      });
    });

    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByText("浜屽彿鑲′唤")).toBeInTheDocument();
    const table = container.querySelector(".data-table");
    expect(table).toBeInTheDocument();
    expect(within(table as HTMLElement).getByText("4.32%")).toBeInTheDocument();
    expect(within(table as HTMLElement).getByText("8.76%")).toBeInTheDocument();
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
