import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "../../app/preferencesStore";
import { BoardHeightPage } from "./BoardHeightPage";

const snapshot = {
  available_trade_dates: ["2026-05-12", "2026-05-11"],
  chart_items: [
    { date: "2026-05-10", leader_code: "000001", leader_name: "一号股份", stock_count: 3, value: 2 },
    { date: "2026-05-11", leader_code: "000002", leader_name: "二号股份", stock_count: 5, value: 4 },
    { date: "2026-05-12", leader_code: "000003", leader_name: "三号股份", stock_count: 8, value: 6 }
  ],
  columns: [
    { date: "2026-05-11", stocks: [{ board_count: 4, code: "000002", name: "二号股份" }] },
    { date: "2026-05-12", stocks: [{ board_count: 6, code: "000003", name: "三号股份" }] }
  ],
  fetched_at: "2026-05-12 15:01:00",
  latest_height: 6,
  next_trade_date: null,
  previous_trade_date: "2026-05-11",
  trade_date: "2026-05-12"
};

describe("BoardHeightPage", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ apiBaseUrl: "http://api.test" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the old linked height workflow instead of fake K-line data", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => jsonResponse(snapshot));
    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByLabelText("连板高度折线图")).toBeInTheDocument();
    expect(container.querySelector(".kline-chart")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "选择 2026-05-11 高度 4 板" }));

    expect(screen.getByTestId("height-active-date")).toHaveTextContent("2026-05-11");
    expect(screen.getByTestId("height-date-card-2026-05-11")).toHaveClass("selected");
  }, 15000);

  it("links matrix stock clicks back to the matching height date", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => jsonResponse(snapshot));

    renderWithClient(fetchMock);

    const stockButtons = await screen.findAllByRole("button", { name: /二号股份/ });
    const matrixButton = stockButtons.find((button) => button.classList.contains("height-matrix-stock"));
    expect(matrixButton).toBeInstanceOf(HTMLButtonElement);

    await user.click(matrixButton as HTMLButtonElement);

    expect(screen.getByTestId("height-active-date")).toHaveTextContent("2026-05-11");
    expect(screen.getByTestId("height-date-card-2026-05-11")).toHaveClass("selected");
  });

  it("limits the visible height workspace to the latest 20 trading days", async () => {
    const longSnapshot = {
      ...snapshot,
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
      })),
      trade_date: "2026-04-25"
    };
    const fetchMock = vi.fn(async () => jsonResponse(longSnapshot));
    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByLabelText("连板高度折线图")).toBeInTheDocument();
    expect(screen.getByText("20 日")).toBeInTheDocument();
    expect(container.querySelectorAll(".height-matrix-date")).toHaveLength(20);
    expect(screen.queryByTestId("height-date-card-2026-04-01")).not.toBeInTheDocument();
    expect(screen.getByTestId("height-date-card-2026-04-25")).toBeInTheDocument();
  });

  it("separates the curve, anchor detail and latest 20-day matrix for readable layout", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(snapshot));
    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByLabelText("连板高度折线图")).toBeInTheDocument();
    expect(container.querySelector(".height-workspace-grid")).toBeInTheDocument();
    expect(container.querySelector(".height-trend-card")).toHaveClass("height-trend-card");
    expect(container.querySelector(".height-inspector-card")).toBeInTheDocument();
    expect(screen.getByText("高度矩阵")).toBeInTheDocument();
    expect(screen.getByText("最近 20 日")).toBeInTheDocument();
  });

  it("keeps low heights neutral and colorizes only 4-board and above by recent maximum", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      ...snapshot,
      columns: [
        { date: "2026-05-10", stocks: [{ board_count: 2, code: "000001", name: "一号股份" }] },
        { date: "2026-05-11", stocks: [{ board_count: 4, code: "000002", name: "二号股份" }] },
        { date: "2026-05-12", stocks: [{ board_count: 8, code: "000003", name: "三号股份" }] }
      ],
      chart_items: [
        { date: "2026-05-10", leader_code: "000001", leader_name: "一号股份", stock_count: 3, value: 2 },
        { date: "2026-05-11", leader_code: "000002", leader_name: "二号股份", stock_count: 5, value: 4 },
        { date: "2026-05-12", leader_code: "000003", leader_name: "三号股份", stock_count: 8, value: 8 }
      ],
      latest_height: 8
    }));
    renderWithClient(fetchMock);

    const low = (await screen.findAllByText("一号股份")).map((element) => element.closest("button")).find((button) => button?.classList.contains("height-matrix-stock"));
    const mid = screen.getAllByText("二号股份").map((element) => element.closest("button")).find((button) => button?.classList.contains("height-matrix-stock"));
    const high = screen.getAllByText("三号股份").map((element) => element.closest("button")).find((button) => button?.classList.contains("height-matrix-stock"));

    expect(low).toBeInstanceOf(HTMLButtonElement);
    expect(mid).toBeInstanceOf(HTMLButtonElement);
    expect(high).toBeInstanceOf(HTMLButtonElement);
    expect(low).toHaveClass("tone-neutral");
    expect(low).not.toHaveClass("tone-hot");
    expect(mid).toHaveClass("tone-heat-1");
    expect(high).toHaveClass("tone-heat-4");
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
      <BoardHeightPage />
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}
