import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "../../app/preferencesStore";
import { OverviewPage } from "./OverviewPage";

const snapshot = {
  amount_summary: { predicted_amount_yi: 9800, total_amount_yi: 8200 },
  breadth_summary: { down_count: 1800, down_ratio: 38, up_count: 2700, up_ratio: 57 },
  generated_at: "2026-05-14 15:10:00",
  indices: [{ change_pct: "+1.25%", code: "000001", display_value: "3230.12", market: "A 股", short_name: "上证指数" }],
  notices: [],
  plate_rotation: {
    items: [{ latest_strength: 15.7, latest_strength_text: "+15.70%", latest_zt: 8, plate_code: "BK001", plate_name: "算力", series: [] }],
    matrix_columns: [],
    total: 1
  },
  sentiment: {
    metrics: [{ delta: 3, key: "zt", label: "涨停", today: 58 }],
    score: 72,
    stage: "强势"
  },
  shell_status: {
    data_freshness: "实时",
    job_health: { healthy_jobs: 3, total_jobs: 4 },
    market_phase: "盘后",
    watched_jobs: [{ health: "healthy", job_code: "limit_review", last_status: "completed", name: "涨停复盘" }]
  },
  snapshot_at: "2026-05-14 15:09:00",
  trade_date: "2026-05-14"
};

describe("OverviewPage", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ apiBaseUrl: "http://api.test" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Chinese section eyebrows instead of visible English labels", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(snapshot)));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <OverviewPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText("指数")).toBeInTheDocument();
    expect(screen.getByText("运行状态")).toBeInTheDocument();
    expect(screen.getByText("风险提示")).toBeInTheDocument();
    expect(screen.getByText("市场情绪")).toBeInTheDocument();
    expect(screen.queryByText("Indices")).not.toBeInTheDocument();
    expect(screen.queryByText("Runtime")).not.toBeInTheDocument();
    expect(screen.queryByText("Notices")).not.toBeInTheDocument();
    expect(screen.queryByText("Sentiment")).not.toBeInTheDocument();
  });

  it("renders index cards as compact market cockpit panels", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(snapshot)));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const { container } = render(
      <QueryClientProvider client={client}>
        <OverviewPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText("上证指数")).toBeInTheDocument();
    expect(screen.getByText("SH")).toBeInTheDocument();
    expect(container.querySelector(".index-cockpit")).toBeInTheDocument();
    expect(container.querySelector(".index-market-card .index-spark-bars")).toBeInTheDocument();
    expect(container.querySelector(".index-change-pill")).toHaveTextContent("+1.25%");
  });

  it("localizes common index abbreviations in the cockpit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ...snapshot,
          indices: [{ code: "sh", display_value: "3230.12", market: "Shanghai", short_name: "SH" }]
        })
      )
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <OverviewPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText("上证指数")).toBeInTheDocument();
    expect(screen.getByText("沪市")).toBeInTheDocument();
    expect(screen.queryByText("Shanghai")).not.toBeInTheDocument();
  });

  it("uses latest_zt as the overview plate rotation strength instead of percentage strength", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ...snapshot,
          plate_rotation: {
            ...snapshot.plate_rotation,
            items: [{
              latest_strength: 126.19,
              latest_strength_text: "+126.19%",
              latest_zt: 12619,
              plate_code: "BK001",
              plate_name: "算力",
              series: [
                { date: "2026-05-13", latest_zt: 12619, strength: 126.19, strength_text: "+126.19%" }
              ]
            }]
          }
        })
      )
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={client}>
        <OverviewPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText("强度 12619")).toBeInTheDocument();
    expect(screen.queryByText("强度 126.19")).not.toBeInTheDocument();
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}
