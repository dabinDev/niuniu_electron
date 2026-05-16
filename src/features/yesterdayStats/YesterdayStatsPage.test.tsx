import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "../../app/preferencesStore";
import { YesterdayStatsPage } from "./YesterdayStatsPage";

const snapshot = {
  fetched_at: "2026-05-14 15:01:00",
  sections: [
    {
      items: [
        { amount_yi: "1.2", change_pct: "9.98", code: "000001", industry: "软件", name: "一号股份", open_change_pct: "3.2", region: "深圳" }
      ],
      key: "zt",
      title: "zt",
      total: "1"
    },
    {
      items: [],
      key: "today_broken_board",
      title: "today_broken_board",
      total: "0"
    }
  ],
  today_stats: { lb: 2, zb: 3, zt: 4 },
  trade_date: "2026-05-14",
  trade_dates: { current: "2026-05-14" },
  yesterday_stats: { dt: 1 }
};

describe("YesterdayStatsPage", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ apiBaseUrl: "http://api.test" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("places section tabs on the left and formats change columns with percent units", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(snapshot));
    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByText("一号股份")).toBeInTheDocument();
    const workspace = container.querySelector(".yesterday-stats-workspace");
    expect(workspace).toBeInTheDocument();
    expect(workspace?.querySelector(".yesterday-stats-tabs .segmented")).toBeInTheDocument();
    const table = workspace?.querySelector(".data-table");
    expect(table).toBeInTheDocument();
    expect(within(table as HTMLElement).getByText("3.2%")).toBeInTheDocument();
    expect(within(table as HTMLElement).getByText("9.98%")).toBeInTheDocument();
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
      <YesterdayStatsPage />
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}
