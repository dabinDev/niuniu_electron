import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "../../app/preferencesStore";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "niuniu", {
      configurable: true,
      value: {
        appName: "NiuNiu",
        getMachineCode: async () => ({ machineCode: "NN-EXISTING", version: "win-v1" })
      }
    });
    usePreferencesStore.setState({
      accessActivation: {
        accessId: "trial_existing",
        accessMode: "trial",
        activatedAt: "2026-05-17T02:00:00Z",
        activationSecret: "secret",
        machineCode: "NN-EXISTING",
        machineCodeVersion: "win-v1"
      },
      inviteAccessMode: "trial",
      inviteAcknowledged: true,
      inviteCode: "",
      motionEnabled: true,
      sidebarCollapsed: false,
      theme: "dark"
    });
  });

  it("collapses the left sidebar to compact navigation marks", async () => {
    render(
      <MemoryRouter initialEntries={["/limit-review"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByText("涨停复盘")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "折叠侧边栏" }));
    expect(screen.queryByText("涨停复盘")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "复 涨停复盘 AI 分析页" })).toBeInTheDocument();
  });

  it("uses function keys to switch sections unless the user is typing", async () => {
    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <LocationEcho />
          <input aria-label="搜索" />
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByTestId("location")).toHaveTextContent("/overview");
    await userEvent.keyboard("{F8}");
    expect(screen.getByTestId("location")).toHaveTextContent("/limit-review");

    await userEvent.click(screen.getByLabelText("搜索"));
    await userEvent.keyboard("{F12}");
    expect(screen.getByTestId("location")).toHaveTextContent("/limit-review");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "F12" }));
    });
    expect(screen.getByTestId("location")).toHaveTextContent("/limit-review");
  });

  it("wires the custom window lights to Electron window controls", async () => {
    const windowControl = vi.fn(async () => ({ message: "ok", success: true }));
    Object.defineProperty(window, "niuniu", {
      configurable: true,
      value: { appName: "NiuNiu", windowControl }
    });

    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("button", { name: "最小化窗口" }));
    await userEvent.click(screen.getByRole("button", { name: "最大化或还原窗口" }));
    await userEvent.click(screen.getByRole("button", { name: "关闭窗口" }));

    expect(windowControl).toHaveBeenNthCalledWith(1, "minimize");
    expect(windowControl).toHaveBeenNthCalledWith(2, "toggle-maximize");
    expect(windowControl).toHaveBeenNthCalledWith(3, "close");
  });

  it("opens settings and message center from sidebar quick actions", async () => {
    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("button", { name: "打开联动设置" }));
    expect(screen.getByRole("dialog", { name: "客户端设置" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "关闭设置" }));

    await userEvent.click(screen.getByRole("button", { name: "打开消息中心" }));
    expect(screen.getByRole("dialog", { name: "消息中心 / 7x24" })).toBeInTheDocument();
  });

  it("keeps AI-capable pages distinguishable in collapsed sidebar", async () => {
    render(
      <MemoryRouter initialEntries={["/ask-ai"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("button", { name: "折叠侧边栏" }));

    expect(screen.getByRole("link", { name: "AI 问 AI AI 分析页" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "复 涨停复盘 AI 分析页" })).toBeInTheDocument();
  });

  it("renders a dedicated AI NiuNiu logo in the upper sidebar area", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/ask-ai"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByLabelText("AI 牛牛功能标识")).toBeInTheDocument();
    expect(screen.getByText("AI 牛牛")).toBeInTheDocument();
    expect(screen.getByAltText("AI 牛牛图标")).toBeInTheDocument();
    expect(container.querySelector(".ai-niuniu-mark .brand-icon-image")).toBeInTheDocument();
    expect(container.querySelector(".ai-niuniu-mark .niuniu-bull-mark")).not.toBeInTheDocument();
    expect(container.querySelector(".ai-niuniu-mark svg")).not.toBeInTheDocument();
  });

  it("uses the provided NiuNiu icon image for the app brand instead of generated marks", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByAltText("牛牛开盘图标")).toBeInTheDocument();
    expect(container.querySelector(".brand-mark .brand-icon-image")).toBeInTheDocument();
    expect(container.querySelector(".brand-mark .niuniu-bull-mark")).not.toBeInTheDocument();
    expect(container.querySelector(".brand-mark")).not.toHaveTextContent("N");
  });

  it("renders distinctive sidebar icon tokens instead of plain text-only marks", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(container.querySelector(".nav-icon-mark.nav-icon-overview")).toBeInTheDocument();
    expect(container.querySelector(".nav-icon-mark.nav-icon-board-tier")).toBeInTheDocument();
    expect(container.querySelector(".nav-icon-mark.nav-icon-ask-ai")).toBeInTheDocument();
  });

  it("renders one-character sidebar icon tokens instead of detailed svg marks", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(container.querySelector(".nav-icon-mark.nav-icon-overview svg")).not.toBeInTheDocument();
    expect(container.querySelector(".nav-icon-mark.nav-icon-board-tier svg")).not.toBeInTheDocument();
    expect(container.querySelector(".nav-icon-mark.nav-icon-ask-ai svg")).not.toBeInTheDocument();
    expect(container.querySelector(".nav-icon-mark.nav-icon-overview")).toHaveTextContent("总");
    expect(container.querySelector(".nav-icon-mark.nav-icon-board-tier")).toHaveTextContent("梯");
    expect(container.querySelector(".nav-icon-mark.nav-icon-ask-ai")).toHaveTextContent("AI");
  });

  it("separates collapsed icon text from hidden nav labels for fullscreen compact mode", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("button", { name: "折叠侧边栏" }));

    expect(container.querySelector(".app-root")).toHaveClass("sidebar-collapsed");
    expect(container.querySelector(".nav-icon-mark.nav-icon-overview span")).toHaveTextContent("总");
    expect(container.querySelector(".nav-label")).not.toBeInTheDocument();
  });

  it("keeps settings and message center reachable when the sidebar is collapsed", async () => {
    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("button", { name: "折叠侧边栏" }));

    await userEvent.click(screen.getByRole("button", { name: "打开联动设置" }));
    expect(screen.getByRole("dialog", { name: "客户端设置" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "关闭设置" }));

    await userEvent.click(screen.getByRole("button", { name: "打开消息中心" }));
    expect(screen.getByRole("dialog", { name: "消息中心 / 7x24" })).toBeInTheDocument();
  });

  it("removes rounded shell spacing when Electron reports a maximized window", async () => {
    Object.defineProperty(window, "niuniu", {
      configurable: true,
      value: {
        appName: "NiuNiu",
        getWindowState: vi.fn(async () => ({ isFullScreen: false, isMaximized: true })),
        onWindowStateChange: vi.fn(() => () => undefined)
      }
    });

    const { container } = render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    await screen.findByText("content");
    await screen.findByText("实时同步中");
    expect(container.querySelector(".app-root")).toHaveClass("window-maximized");
  });

  it("shows the invitation and usage notice after the first app load", async () => {
    usePreferencesStore.setState({
      inviteAccessMode: null,
      inviteAcknowledged: false,
      inviteCode: ""
    });

    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(await screen.findByRole("dialog", { name: "牛牛开盘使用声明与邀请验证" })).toBeInTheDocument();
    expect(screen.getByText("本项目仅作学习、研究与数据复盘使用。如涉及权利问题，请联系作者处理。")).toBeInTheDocument();
    expect(screen.getByText("所有功能不构成股票、基金或其他金融产品的投资建议。请保持独立判断，理性看待市场波动。")).toBeInTheDocument();
    expect(screen.getByText("AI 内容由模型基于数据综合生成，可能存在遗漏、偏差或误读，作者不对 AI 输出及其使用结果负责。")).toBeInTheDocument();
  });

  it("lets a first-time user enter trial mode and stores that acknowledgement", async () => {
    mockActivationEnvironment("trial_access", "trial");
    usePreferencesStore.setState({
      accessActivation: null,
      inviteAccessMode: null,
      inviteAcknowledged: false,
      inviteCode: ""
    });

    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole("button", { name: "试用体验" }));

    expect(screen.queryByRole("dialog", { name: "牛牛开盘使用声明与邀请验证" })).not.toBeInTheDocument();
    expect(usePreferencesStore.getState().inviteAcknowledged).toBe(true);
    expect(usePreferencesStore.getState().inviteAccessMode).toBe("trial");
    expect(usePreferencesStore.getState().accessActivation?.accessId).toBe("trial_access");
  });

  it("accepts a non-empty invitation code and stores invited access", async () => {
    const fetchMock = mockActivationEnvironment("invite_access", "invite");
    usePreferencesStore.setState({
      accessActivation: null,
      inviteAccessMode: null,
      inviteAcknowledged: false,
      inviteCode: ""
    });

    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    const input = await screen.findByLabelText("邀请码");
    await userEvent.type(input, "  alpha-2026  ");
    await userEvent.click(screen.getByRole("button", { name: "验证并进入" }));

    expect(screen.queryByRole("dialog", { name: "牛牛开盘使用声明与邀请验证" })).not.toBeInTheDocument();
    expect(usePreferencesStore.getState().inviteAcknowledged).toBe(true);
    expect(usePreferencesStore.getState().inviteAccessMode).toBe("invite");
    expect(usePreferencesStore.getState().inviteCode).toBe("");
    expect(usePreferencesStore.getState().accessActivation?.accessId).toBe("invite_access");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:18081/api/v1/access/activate",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("renders the machine code in the sidebar and copies it", async () => {
    const copyText = vi.fn(async () => ({ message: "ok", success: true }));
    usePreferencesStore.setState({
      accessActivation: null,
      inviteAcknowledged: true,
      inviteAccessMode: "trial"
    });
    Object.defineProperty(window, "niuniu", {
      configurable: true,
      value: {
        appName: "NiuNiu",
        copyText,
        getMachineCode: async () => ({ machineCode: "NN-SIDEBAR-MACHINE", version: "win-v1" })
      }
    });

    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(await screen.findByText("NN-SIDEBAR-MACHINE")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "复制机器码" }));
    expect(copyText).toHaveBeenCalledWith("NN-SIDEBAR-MACHINE");
  });
});

function LocationEcho() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function mockActivationEnvironment(accessId: string, accessType: "trial" | "invite") {
  Object.defineProperty(window, "niuniu", {
    configurable: true,
    value: {
      appName: "NiuNiu",
      getMachineCode: async () => ({ machineCode: "NN-TEST-MACHINE", version: "win-v1" })
    }
  });
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({
    access_id: accessId,
    access_type: accessType,
    activated_at: "2026-05-17T02:00:00Z",
    activation_secret: "activation-secret",
    machine_code: "NN-TEST-MACHINE",
    machine_code_version: "win-v1",
    quotas: {
      ask_ai: { limit: accessType === "trial" ? 2 : 5, remaining: accessType === "trial" ? 2 : 5, used: 0 },
      auction: { limit: accessType === "trial" ? 2 : 5, remaining: accessType === "trial" ? 2 : 5, used: 0 },
      limit_review: { limit: accessType === "trial" ? 2 : 5, remaining: accessType === "trial" ? 2 : 5, used: 0 }
    }
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
