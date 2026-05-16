import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "../../app/preferencesStore";
import { PlateRotationPage } from "./PlateRotationPage";

const snapshot = {
  available_trade_dates: ["2026-05-14", "2026-05-13"],
  fetched_at: "2026-05-14 15:01:00",
  items: [
    { plate_code: "BK001", plate_name: "算力", latest_strength: 15.74, latest_strength_text: "+15.74%", latest_zt: 8 },
    { plate_code: "BK002", plate_name: "芯片", latest_strength: 11.03, latest_strength_text: "+11.03%", latest_zt: 6 }
  ],
  matrix_columns: [
    {
      date: "2026-05-14",
      items: [
        { rank: 1, plate_code: "", plate_name: "算力", strength: 15.74, strength_text: "+15.74%", zt_count: 8 },
        { rank: 2, plate_code: "BK002", plate_name: "芯片", strength: 9.2, strength_text: "+9.20%", zt_count: 5 }
      ]
    },
    {
      date: "2026-05-13",
      items: [
        { rank: 1, plate_code: "BK002", plate_name: "芯片", strength: 11.03, strength_text: "+11.03%", zt_count: 6 },
        { rank: 2, plate_code: "BK001", plate_name: "算力", strength: 5.07, strength_text: "+5.07%", zt_count: 4 }
      ]
    }
  ],
  next_trade_date: null,
  previous_trade_date: "2026-05-13",
  total: 2,
  trade_date: "2026-05-14"
};

const stocks = {
  items: [{ code: "000001", name: "平安银行", change_pct: "+10.01%", latest_price: "12.34", reason: "板块龙头" }]
};

describe("PlateRotationPage", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ apiBaseUrl: "http://api.test" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the rotation matrix as real rows that remain clickable", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/plate-rotation")) {
        return jsonResponse(snapshot);
      }
      if (requestUrl.includes("/api/v1/plates/BK001/stocks")) {
        return jsonResponse(stocks);
      }
      return jsonResponse({});
    });

    renderWithClient(fetchMock);

    const matrix = await screen.findByTestId("rotation-matrix");
    expect(matrix.querySelectorAll(".matrix-row")).toHaveLength(2);
    expect(matrix.querySelector(".matrix-row")).not.toHaveAttribute("style", expect.stringContaining("display: contents"));
    expect(matrix.querySelectorAll(".matrix-cell-meter")).toHaveLength(4);
    expect(matrix.querySelectorAll(".matrix-strength-value")[0]).toHaveTextContent("强度 8");
    expect(matrix.querySelectorAll(".matrix-strength-value")[0]).not.toHaveTextContent("%");
    expect(screen.getByText("排名与日期强度矩阵")).toBeInTheDocument();
    expect(screen.queryByText("排名 x 日期强度矩阵")).not.toBeInTheDocument();
    expect(screen.getByText("强度趋势")).toBeInTheDocument();
    expect(screen.getByText("强度序列")).toBeInTheDocument();
    expect(screen.queryByText("Strength Series")).not.toBeInTheDocument();

    await user.click(within(matrix).getByRole("button", { name: /算力 强度 8/ }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/plates/BK001/stocks?limit=30"),
      expect.objectContaining({ method: "GET" })
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("trade_date="),
      expect.objectContaining({ method: "GET" })
    );
    expect(await screen.findByText("平安银行")).toBeInTheDocument();
  }, 15000);

  it("does not animate glass cards as grid rows, so tall matrix cards keep their layout height", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

    expect(css).not.toMatch(/\.page-scroll\s*>\s*\.glass-card[\s\S]*?animation:\s*pageLayerIn/);
    expect(css).toMatch(/\.page-scroll\s*\{[\s\S]*grid-auto-rows:\s*max-content/);
  });

  it("renders plate stocks from the backend date-grouped response", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/plate-rotation")) {
        return jsonResponse(snapshot);
      }
      if (requestUrl.includes("/api/v1/plates/BK001/stocks")) {
        return jsonResponse({
          items: [
            {
              date: "2026-05-14",
              stocks: [{ rank_no: 1, stock_code: "000001", stock_name: "Alpha Bank" }],
              total: 1
            }
          ]
        });
      }
      return jsonResponse({});
    });

    renderWithClient(fetchMock);

    const matrix = await screen.findByTestId("rotation-matrix");
    const firstPlate = matrix.querySelector("button:not([disabled])");
    expect(firstPlate).toBeInstanceOf(HTMLButtonElement);
    await user.click(firstPlate as HTMLButtonElement);

    expect(await screen.findByText("Alpha Bank")).toBeInTheDocument();
  });

  it("requests and displays a 20-day rotation matrix by default", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/plate-rotation")) {
        return jsonResponse(snapshot);
      }
      return jsonResponse({});
    });

    renderWithClient(fetchMock);

    await screen.findByTestId("rotation-matrix");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/plate-rotation?limit=20"),
      expect.objectContaining({ method: "GET" })
    );
  });

  it("keeps the strength trend close to the rotation summary instead of burying it below every matrix row", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/plate-rotation")) {
        return jsonResponse(snapshot);
      }
      return jsonResponse({});
    });

    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByText("强度趋势")).toBeInTheDocument();
    const trend = container.querySelector(".rotation-trend-card");
    const matrix = container.querySelector(".rotation-matrix-card");
    expect(trend).toBeInTheDocument();
    expect(matrix).toBeInTheDocument();
    if (!trend || !matrix) throw new Error("Rotation trend or matrix card missing");
    expect(trend.compareDocumentPosition(matrix) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("highlights every visible instance of the selected plate across dates", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/plate-rotation")) {
        return jsonResponse(snapshot);
      }
      return jsonResponse({ items: [] });
    });

    const { container } = renderWithClient(fetchMock);

    const matrix = await screen.findByTestId("rotation-matrix");
    const selectedTarget = within(matrix).getByRole("button", { name: /算力 强度 8/ });
    await user.click(selectedTarget);

    const samePlateCells = Array.from(container.querySelectorAll(".matrix-cell.same-plate")).map((node) => node.textContent);
    expect(samePlateCells).toHaveLength(2);
    expect(samePlateCells.join(" ")).toContain("强度 8");
    expect(samePlateCells.join(" ")).toContain("强度 4");
    expect(container.querySelectorAll(".rotation-strip article.same-plate")).toHaveLength(1);
  });

  it("uses a compact rotation sequence with differentiated color tokens", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/plate-rotation")) {
        return jsonResponse(snapshot);
      }
      return jsonResponse({});
    });

    const { container } = renderWithClient(fetchMock);

    await screen.findByTestId("rotation-matrix");
    expect(container.querySelector(".rotation-strip")).toHaveClass("rotation-strip-compact");

    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    expect(css).toMatch(/\.color-0\s*\{[\s\S]*--plate-accent:\s*#ff2f4b/);
    expect(css).toMatch(/\.color-2\s*\{[\s\S]*--plate-accent:\s*#00d4ff/);
    expect(css).toMatch(/:where\(\.matrix-cell,\s*\.near-plate,\s*\.rotation-strip article\)\s*\{[\s\S]*--plate-rgb:\s*255,\s*77,\s*85/);
    expect(css).toMatch(/\.rotation-strip-compact\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(138px,\s*1fr\)\)/);
    expect(css).toMatch(/\.rotation-strip-compact\s*\{[\s\S]*align-items:\s*start/);
    expect(css).toMatch(/\.rotation-strip-compact article\s*\{[\s\S]*align-self:\s*start/);
  });

  it("uses latest_zt and zt_count raw strength values for displayed strength", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/plate-rotation")) {
        return jsonResponse({
          ...snapshot,
          items: [{ plate_code: "BK001", plate_name: "算力", latest_strength: 15.74, latest_zt: 15740 }],
          matrix_columns: [
            { date: "2026-05-14", items: [{ rank: 1, plate_code: "BK001", plate_name: "算力", strength: 15.74, zt_count: 12619 }] }
          ]
        });
      }
      return jsonResponse({});
    });

    renderWithClient(fetchMock);

    const matrix = await screen.findByTestId("rotation-matrix");
    expect(within(matrix).getByText("强度 12619")).toBeInTheDocument();
    expect(screen.getAllByText("强度 15740").length).toBeGreaterThan(0);
    expect(within(matrix).queryByText("%")).not.toBeInTheDocument();
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
      <PlateRotationPage />
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}
