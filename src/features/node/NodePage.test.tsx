import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "../../app/preferencesStore";
import { NodePage } from "./NodePage";

const snapshot = {
  default_date: "2026-05-14",
  date_items: [
    {
      date: "2026-05-12",
      top_plates: [{ plate_code: "BK001", plate_name: "算力", rank: 1, strength_text: "+12.4%", zt_count: 8 }]
    },
    {
      date: "2026-05-13",
      top_plates: [{ plate_code: "BK001", plate_name: "算力", rank: 2, strength_text: "+10.1%", zt_count: 6 }]
    },
    {
      date: "2026-05-14",
      top_plates: [{ plate_code: "BK002", plate_name: "芯片", rank: 1, strength_text: "+9.8%", zt_count: 5 }, { plate_code: "BK001", plate_name: "算力", rank: 2, strength_text: "+7.8%", zt_count: 4 }]
    }
  ],
  fetched_at: "2026-05-14 15:01:00",
  kline: {
    bars: [
      { trade_date: "2026-05-08", open_price: 9600, close_price: 9680, high_price: 9710, low_price: 9550, volume: 1200000 },
      { trade_date: "2026-05-11", open_price: 9680, close_price: 9620, high_price: 9720, low_price: 9588, volume: 1380000 },
      { trade_date: "2026-05-12", open_price: 9620, close_price: 9810, high_price: 9850, low_price: 9610, volume: 1580000 },
      { trade_date: "2026-05-13", open_price: 9810, close_price: 9890, high_price: 9930, low_price: 9760, volume: 1440000 },
      { trade_date: "2026-05-14", open_price: 9890, close_price: 10020, high_price: 10080, low_price: 9870, volume: 1860000 }
    ],
    total: 5
  },
  quote: { change_pct: "1.28", name: "深成指", price: "10020.36" },
  trade_date: "2026-05-14"
};

describe("NodePage", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ apiBaseUrl: "http://api.test" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the stable default index and renders a full K-line chart", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/node/snapshot")) {
        return jsonResponse(snapshot);
      }
      return jsonResponse({});
    });

    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByDisplayValue("sz399001")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/node/snapshot?symbol=sz399001&days=60&plate_limit=8"),
      expect.objectContaining({ method: "GET" })
    );
    expect(container.querySelector(".kline-chart")).toBeInTheDocument();
    expect(container.querySelector(".chart-close-line")).toBeInTheDocument();
    expect(container.querySelectorAll(".chart-ma-line")).toHaveLength(2);
    expect(screen.getAllByTestId("volume-bar")).toHaveLength(5);
  });

  it("does not request a new index snapshot until the query button is clicked", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/node/snapshot")) {
        return jsonResponse(snapshot);
      }
      return jsonResponse({});
    });

    renderWithClient(fetchMock);

    const input = await screen.findByDisplayValue("sz399001");
    const initialSnapshotCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/v1/node/snapshot")).length;
    await user.clear(input);
    await user.type(input, "sh000001");

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/v1/node/snapshot"))).toHaveLength(initialSnapshotCalls);
    await user.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/node/snapshot?symbol=sh000001&days=60&plate_limit=8"),
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  it("prioritizes the K-line chart before the dense date detail list", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/node/snapshot")) {
        return jsonResponse(snapshot);
      }
      return jsonResponse({});
    });

    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByLabelText("K线图")).toBeInTheDocument();
    const klineCard = container.querySelector(".kline-card");
    expect(klineCard).toBeInTheDocument();
    const chart = klineCard?.querySelector(".kline-chart");
    const detailList = klineCard?.querySelector(".node-date-list");
    expect(chart).toBeInTheDocument();
    expect(detailList).toBeInTheDocument();
    if (!chart || !detailList) throw new Error("K-line chart or node date list missing");
    expect(chart.compareDocumentPosition(detailList) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the leader stocks in the top band so the K-line workspace can use the full page width", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/node/snapshot")) {
        return jsonResponse(snapshot);
      }
      return jsonResponse({
        leaders: [{ rank_no: 1, stock_code: "000001", stock_name: "平安银行" }],
        plate_code: "BK002",
        plate_name: "芯片",
        total: 1
      });
    });

    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByLabelText("K线图")).toBeInTheDocument();
    expect(container.querySelector(".node-top-band")).toBeInTheDocument();
    expect(container.querySelector(".node-kline-workspace")).toBeInTheDocument();
    expect(container.querySelector(".node-top-band .node-leader-card")).toBeInTheDocument();
    expect(container.querySelector(".node-kline-workspace .node-leader-card")).not.toBeInTheDocument();
    expect(container.querySelector(".node-kline-workspace .kline-chart")).toBeInTheDocument();
  });

  it("uses a compact top band layout with the repeat-plate hint in the card header", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/node/snapshot")) {
        return jsonResponse(snapshot);
      }
      return jsonResponse({
        leaders: [{ rank_no: 1, stock_code: "000001", stock_name: "骞冲畨閾惰" }],
        plate_code: "BK002",
        plate_name: "鑺墖",
        total: 1
      });
    });

    const { container } = renderWithClient(fetchMock);

    await waitFor(() => expect(container.querySelector(".node-frequency-card")).toBeInTheDocument());
    const frequencyCard = container.querySelector(".node-frequency-card");
    expect(frequencyCard).toBeInTheDocument();
    expect(frequencyCard?.querySelector(".card-head .node-frequency-head-note")).toBeInTheDocument();
    expect(frequencyCard?.querySelector(".node-frequency-panel > .node-frequency-tags")).toBeInTheDocument();
    expect(frequencyCard?.querySelector(".node-frequency-panel > div:first-child:not(.node-frequency-tags)")).not.toBeInTheDocument();
    expect(container.querySelector(".node-top-band .node-leader-card")).toHaveClass("node-leader-card");
  });

  it("links date, plate and leader table like the old node workflow", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/node/snapshot")) {
        return jsonResponse(snapshot);
      }
      if (requestUrl.includes("/api/v1/node/plates/BK001/leaders")) {
        return jsonResponse({
          leaders: [{ rank_no: 1, stock_code: "000001", stock_name: "平安银行", quote: { change_pct: 10.01, price: 12.34 } }],
          plate_code: "BK001",
          plate_name: "算力",
          total: 1
        });
      }
      return jsonResponse({ leaders: [] });
    });

    renderWithClient(fetchMock);

    expect(await screen.findByText("21 日重复板块")).toBeInTheDocument();
    const frequencyPanel = screen.getByText("21 日重复板块").closest(".node-frequency-card");
    expect(frequencyPanel).toBeInstanceOf(HTMLElement);
    expect(within(frequencyPanel as HTMLElement).getByRole("button", { name: /算力/ })).toHaveTextContent("出现 3 次");

    await user.click(screen.getByRole("button", { name: "选择 2026-05-13 算力" }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/node/plates/BK001/leaders?date=2026-05-13&stock_limit=20"),
      expect.objectContaining({ method: "GET" })
    );
    const leaderPanel = await screen.findByTestId("node-leader-panel");
    expect(within(leaderPanel).getByText("平安银行")).toBeInTheDocument();
  }, 15000);

  it("links K-line date clicks to the matching date and its first plate", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/node/snapshot")) {
        return jsonResponse(snapshot);
      }
      if (requestUrl.includes("/api/v1/node/plates/BK001/leaders")) {
        return jsonResponse({
          leaders: [{ rank_no: 1, stock_code: "000001", stock_name: "平安银行" }],
          plate_code: "BK001",
          plate_name: "算力",
          total: 1
        });
      }
      return jsonResponse({ leaders: [] });
    });

    renderWithClient(fetchMock);

    await screen.findByLabelText("K线图");
    await user.click(screen.getByRole("button", { name: "选择 K 线日期 2026-05-13" }));

    expect(await screen.findByRole("button", { name: "选择 2026-05-13 算力" })).toHaveClass("selected");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/node/plates/BK001/leaders?date=2026-05-13&stock_limit=20"),
      expect.objectContaining({ method: "GET" })
    );
  });

  it("keeps page position stable when a K-line date is clicked", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/node/snapshot")) {
        return jsonResponse(snapshot);
      }
      return jsonResponse({ leaders: [] });
    });

    try {
      const { container } = renderWithClient(fetchMock);

      await waitFor(() => {
        expect(container.querySelector('.chart-date-hit[aria-label*="2026-05-13"]')).toBeInTheDocument();
      });
      const dateHit = container.querySelector('.chart-date-hit[aria-label*="2026-05-13"]');
      if (!(dateHit instanceof HTMLElement)) throw new Error("K-line date hit target missing");
      scrollIntoView.mockClear();
      await user.click(dateHit);
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      Element.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("sorts node date and plate groups from newest to oldest", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/node/snapshot")) {
        return jsonResponse(snapshot);
      }
      return jsonResponse({ leaders: [] });
    });

    const { container } = renderWithClient(fetchMock);

    await screen.findByLabelText("K线图");
    const dateCards = Array.from(container.querySelectorAll(".node-date-list article > b")).map((node) => node.textContent);
    expect(dateCards).toEqual(["05-14", "05-13", "05-12"]);
  });

  it("shows an accurate empty state when the selected plate has no leaders", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/node/snapshot")) {
        return jsonResponse(snapshot);
      }
      return jsonResponse({
        leaders: [],
        plate_code: "BK002",
        plate_name: "芯片",
        total: 0
      });
    });

    renderWithClient(fetchMock);

    const leaderPanel = await screen.findByTestId("node-leader-panel");
    expect(await within(leaderPanel).findByText("当前板块暂无龙头样本")).toBeInTheDocument();
    expect(within(leaderPanel).queryByText("等待选择板块节点")).not.toBeInTheDocument();
  });

  it("labels node plate strength separately from limit-up count", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/node/snapshot")) {
        return jsonResponse(snapshot);
      }
      return jsonResponse({ leaders: [] });
    });

    renderWithClient(fetchMock);

    const selectedPlate = await screen.findByRole("button", { name: "选择 2026-05-14 芯片" });
    expect(selectedPlate).toHaveTextContent("强度 9.8");
    expect(selectedPlate).toHaveTextContent("涨停 5");
    expect(selectedPlate).not.toHaveTextContent("+9.8% · 5 涨停");
  });

  it("does not show encoded strength values as node limit-up counts", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/node/snapshot")) {
        return jsonResponse({
          ...snapshot,
          date_items: [
            {
              date: "2026-05-14",
              top_plates: [{ plate_code: "BK001", plate_name: "算力", rank: 1, strength: 15.74, zt_count: 15740 }]
            }
          ]
        });
      }
      return jsonResponse({ leaders: [] });
    });

    renderWithClient(fetchMock);

    const nodePlate = await screen.findByRole("button", { name: "选择 2026-05-14 算力" });
    expect(nodePlate).toHaveTextContent("强度 15.74");
    expect(nodePlate).toHaveTextContent("涨停 --");
    expect(nodePlate).not.toHaveTextContent("涨停 15740");
  });

  it("does not round strength percentages into node limit-up counts", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/node/snapshot")) {
        return jsonResponse({
          ...snapshot,
          date_items: [
            {
              date: "2026-05-14",
              top_plates: [{ plate_code: "BK001", plate_name: "算力", rank: 1, strength_text: "+15.74%", zt_count: "15.74%" }]
            }
          ]
        });
      }
      return jsonResponse({ leaders: [] });
    });

    renderWithClient(fetchMock);

    const nodePlate = await screen.findByRole("button", { name: "选择 2026-05-14 算力" });
    expect(nodePlate).toHaveTextContent("强度 15.74");
    expect(nodePlate).toHaveTextContent("涨停 --");
    expect(nodePlate).not.toHaveTextContent("涨停 16");
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
      <NodePage />
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}
