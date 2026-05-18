import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "../../app/preferencesStore";
import { AskAiPage } from "./AskAiPage";

const context = {
  cards: [{ key: "zt", label: "涨停", tone: "positive", value: "42" }],
  generated_at: "2026-05-14 15:01:00",
  prompt_sections: [{ content: "复盘上下文", key: "review", title: "涨停复盘" }],
  system_prompt: "你是复盘助手",
  trade_date: "2026-05-14"
};

const auctionCompareContext = {
  ...context,
  prompt_sections: [
    {
      content: "重点竞价个股：\n- 威龙股份 (603779)，竞价对比 9:15 122.3亿 | 9:20 27.3亿 | 9:25 27.4亿 | 涨幅 9.98%",
      key: "auction",
      title: "竞价焦点"
    }
  ]
};

describe("AskAiPage", () => {
  beforeEach(() => {
    localStorage.clear();
    usePreferencesStore.setState({ apiBaseUrl: "http://api.test" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps prompt preview collapsed by default and copies the full prompt", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    localStorage.setItem("niuniu-ask-ai-client-id", "electron-test");
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/ask-ai/context")) return jsonResponse(context);
      if (requestUrl.includes("/api/v1/ask-ai/history")) return jsonResponse({ items: [] });
      if (requestUrl.includes("/api/v1/ask-ai/usage-status")) return jsonResponse({ client_id: "electron-test", features: {}, has_own_key: false });
      return jsonResponse({});
    });

    const { container } = renderWithClient(fetchMock);

    expect(await screen.findByText("提示词预览")).toBeInTheDocument();
    const previewDetails = container.querySelector(".prompt-preview-card details");
    expect(previewDetails).toBeTruthy();
    if (!previewDetails) throw new Error("prompt preview details missing");
    expect(previewDetails).not.toHaveAttribute("open");
    expect(screen.getByTestId("ask-ai-prompt-preview")).not.toBeVisible();

    await user.click(screen.getByText("展开完整提示词"));

    expect(previewDetails).toHaveAttribute("open");
    expect(screen.getByTestId("ask-ai-prompt-preview")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "复制提示词" }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("# 系统提示"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("# 用户问题"));
  });

  it("shows the four-point auction comparison in the ask-ai prompt preview", async () => {
    localStorage.setItem("niuniu-ask-ai-client-id", "electron-test");
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/ask-ai/context")) return jsonResponse(auctionCompareContext);
      if (requestUrl.includes("/api/v1/ask-ai/history")) return jsonResponse({ items: [] });
      if (requestUrl.includes("/api/v1/ask-ai/usage-status")) return jsonResponse({ client_id: "electron-test", features: {}, has_own_key: false });
      return jsonResponse({});
    });

    renderWithClient(fetchMock);

    expect(await screen.findByText("竞价焦点")).toBeInTheDocument();
    expect(screen.getByTestId("ask-ai-prompt-preview")).toHaveTextContent("竞价对比 9:15 122.3亿 | 9:20 27.3亿 | 9:25 27.4亿 | 涨幅 9.98%");
  });

  it("saves personal Kimi settings, sends secret-free client_config, and records local usage", async () => {
    const user = userEvent.setup();
    localStorage.setItem("niuniu-ask-ai-client-id", "electron-test");
    const fetchMock = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/ask-ai/context")) return jsonResponse(context);
      if (requestUrl.includes("/api/v1/ask-ai/history")) return jsonResponse({
        items: [
          {
            result: "## 历史判断\n\n- 观察算力\n\n| 信号 | 状态 |\n| --- | --- |\n| 主线 | 算力回流 |\n\n**执行**：等回流。",
            saved_at: "2026-05-14 16:10:00",
            trade_date: "2026-05-14",
            user_prompt: "历史问题"
          }
        ]
      });
      if (requestUrl.includes("/api/v1/ask-ai/usage-status")) return jsonResponse({ client_id: "electron-test", features: {}, has_own_key: true });
      if (requestUrl.includes("/api/v1/ask-ai/client-config")) return jsonResponse({ api_key_configured: true });
      if (requestUrl.includes("/api/v1/ask-ai/generate")) return jsonResponse({ result: "## AI 复盘结果\n\n- 主线：算力\n- 风险：缩量\n\n**结论**：等待确认。" });
      return jsonResponse({});
    });

    renderWithClient(fetchMock);

    expect(await screen.findByText("AI 服务设置")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("个人 Kimi Key"), { target: { value: "personal-test-key" } });
    fireEvent.change(screen.getByLabelText("模型"), { target: { value: "kimi-k2.6" } });
    fireEvent.change(screen.getByLabelText("本地日上限"), { target: { value: "2" } });
    await user.click(screen.getByRole("button", { name: "保存 AI 设置" }));
    await user.click(screen.getByRole("button", { name: /生成回答/ }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "AI 复盘结果" })).toBeInTheDocument());
    expect(screen.getByText("主线：算力")).toBeInTheDocument();
    expect(screen.getByText("风险：缩量")).toBeInTheDocument();
    expect(screen.getByText("结论")).toBeInTheDocument();
    expect(screen.getByText(/# 系统提示/)).toBeInTheDocument();
    expect(screen.getByText(/# 用户问题/)).toBeInTheDocument();
    expect(screen.queryByText(/# System/)).not.toBeInTheDocument();
    expect(screen.queryByText(/# User/)).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "历史判断" })).toBeInTheDocument();
    expect(screen.getByText("观察算力")).toBeInTheDocument();
    expect(screen.getByText("主线").closest(".history-markdown-table-wrap")).toBeInTheDocument();
    expect(screen.getByTestId("ask-ai-history-list")).toHaveClass("history-list-expanded");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/ask-ai/client-config"),
      expect.objectContaining({
        body: expect.stringContaining("personal-test-key"),
        method: "POST"
      })
    );
    const generateCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/api/v1/ask-ai/generate"));
    expect(generateCall).toBeTruthy();
    if (!generateCall) throw new Error("generate call missing");
    const payload = JSON.parse(String(generateCall[1]?.body ?? ""));
    expect(payload.client_config).toEqual({ client_id: "electron-test", provider: "kimi" });
    expect(JSON.stringify(payload.client_config)).not.toContain("personal-test-key");
    expect(screen.getByTestId("ask-ai-local-usage")).toHaveTextContent(/今日已用 1\/2 次/);
  }, 15000);

  it("blocks generate when the local daily limit is exhausted", async () => {
    const user = userEvent.setup();
    localStorage.setItem("niuniu-ask-ai-client-id", "electron-test");
    localStorage.setItem("niuniu-ask-ai-settings", JSON.stringify({ apiKey: "", dailyLimit: 1, model: "" }));
    localStorage.setItem("niuniu-ask-ai-usage", JSON.stringify({ "kimi|public|": { count: 1, date: "2026-05-14" } }));
    const fetchMock = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/ask-ai/context")) return jsonResponse(context);
      if (requestUrl.includes("/api/v1/ask-ai/history")) return jsonResponse({ items: [] });
      if (requestUrl.includes("/api/v1/ask-ai/usage-status")) return jsonResponse({ client_id: "electron-test", features: {}, has_own_key: false });
      return jsonResponse({});
    });

    renderWithClient(fetchMock);

    await screen.findByText("AI 服务设置");
    await user.click(screen.getByRole("button", { name: /今日额度已用完/ }));

    expect(await screen.findByText(/已达到本地日调用上限/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/ask-ai/generate"),
      expect.anything()
    );
  }, 15000);

  it("disables ask-ai generation when the server feature quota is exhausted", async () => {
    localStorage.setItem("niuniu-ask-ai-client-id", "electron-test");
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/api/v1/ask-ai/context")) return jsonResponse(context);
      if (requestUrl.includes("/api/v1/ask-ai/history")) return jsonResponse({ items: [] });
      if (requestUrl.includes("/api/v1/ask-ai/usage-status")) {
        return jsonResponse({
          client_id: "electron-test",
          features: { ask_ai: { limit: 2, remaining: 0, used: 2 } },
          has_own_key: false
        });
      }
      return jsonResponse({});
    });

    renderWithClient(fetchMock);

    const button = await screen.findByRole("button", { name: /今日额度已用完/ });
    expect(button).toBeDisabled();
    expect(screen.getByTestId("ask-ai-server-usage")).toHaveTextContent("服务端 ask_ai：今日已用 2/2 次，剩余 0 次。");
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
      <AskAiPage />
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}
