import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePreferencesStore } from "../../app/preferencesStore";
import { defaultApiBaseUrl } from "../../core/api/apiBaseUrl";
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
        accessRole: "user",
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
      theme: "light"
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
    expect(screen.getByRole("link", { name: "复 涨停复盘" })).toBeInTheDocument();
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
    await userEvent.keyboard("{F5}");
    expect(screen.getByTestId("location")).toHaveTextContent("/limit-review");

    await userEvent.keyboard("{F12}");
    expect(screen.getByTestId("location")).toHaveTextContent("/limit-review");

    await userEvent.click(screen.getByLabelText("搜索"));
    await userEvent.keyboard("{F12}");
    expect(screen.getByTestId("location")).toHaveTextContent("/limit-review");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "F12" }));
    });
    expect(screen.getByTestId("location")).toHaveTextContent("/limit-review");
  });

  it("shows the task center only for admin activations", () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: /任务中心/ })).not.toBeInTheDocument();

    act(() => {
      usePreferencesStore.setState({
        accessActivation: {
          accessId: "admin_existing",
          accessMode: "invite",
          accessRole: "admin",
          activatedAt: "2026-05-17T02:00:00Z",
          activationSecret: "secret",
          machineCode: "NN-ADMIN",
          machineCodeVersion: "win-v1"
        }
      });
    });

    rerender(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "任 任务中心" })).toBeInTheDocument();
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

  it("keeps only the ask page marked as AI-capable in collapsed sidebar", async () => {
    render(
      <MemoryRouter initialEntries={["/ask-ai"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole("button", { name: "折叠侧边栏" }));

    expect(screen.getByRole("link", { name: "AI 问 AI AI 分析页" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "复 涨停复盘" })).toBeInTheDocument();
  });

  it("renders a short-term trading priority strip in the upper sidebar area", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/ask-ai"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByLabelText("短线看盘优先级")).toBeInTheDocument();
    expect(screen.getByText("短线看盘")).toBeInTheDocument();
    expect(screen.getByText("竞价 · 梯队 · 题材 · 风险")).toBeInTheDocument();
    expect(container.querySelector(".market-strip-mark")).toHaveTextContent("09:25");
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

  it("lets a first-time user request automatic trial access and stores that acknowledgement", async () => {
    const fetchMock = mockActivationEnvironment("trial_access", "trial");
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
    expect(fetchMock).toHaveBeenCalledWith(
      `${defaultApiBaseUrl}/api/v1/access/trial/apply`,
      expect.objectContaining({
        body: expect.stringContaining('"machine_code":"NN-TEST-MACHINE"'),
        method: "POST"
      })
    );
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
      `${defaultApiBaseUrl}/api/v1/access/activate`,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("does not render a manual trial code input because trial access is automatic", async () => {
    mockActivationEnvironment("trial_code_access", "trial");
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

    expect(await screen.findByRole("dialog", { name: "牛牛开盘使用声明与邀请验证" })).toBeInTheDocument();
    expect(screen.queryByLabelText("体验码")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "验证体验码" })).not.toBeInTheDocument();
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

  it("waits for the real Electron app version before automatic update checks", async () => {
    let resolveAppVersion: ((value: { isPackaged: boolean; version: string }) => void) | null = null;
    const getAppVersion = vi.fn(() => new Promise<{ isPackaged: boolean; version: string }>((resolve) => {
      resolveAppVersion = resolve;
    }));
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const requestUrl = String(url);
      if (requestUrl.includes("current_version=0.1.0")) {
        return new Response(JSON.stringify({
          current_version: "0.1.0",
          latest_version: "0.2.2",
          platform: "win",
          has_update: true,
          force_update: true,
          download_url: "https://example.com/electron_niuniu-0.2.2.exe"
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        current_version: "0.2.3",
        latest_version: "0.2.2",
        platform: "win",
        has_update: true,
        force_update: false,
        download_url: "https://example.com/electron_niuniu-0.2.2.exe"
      }), { status: 200 });
    });
    Object.defineProperty(window, "niuniu", {
      configurable: true,
      value: {
        appName: "NiuNiu",
        getAppVersion,
        getMachineCode: async () => ({ machineCode: "NN-EXISTING", version: "win-v1" }),
        onUpdateStatus: vi.fn(() => () => undefined)
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    await waitFor(() => expect(getAppVersion).toHaveBeenCalled());
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveAppVersion?.({ isPackaged: true, version: "0.2.3" });
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("current_version=0.1.0"))).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("current_version=0.2.3"))).toBe(true);
    expect(screen.queryByRole("dialog", { name: "版本更新" })).not.toBeInTheDocument();
  });

  it("opens about dialog and checks updates from the version label", async () => {
    const checkForInstallerUpdate = vi.fn(async () => ({ appVersion: "0.1.0", phase: "not-available" }));
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      current_version: "0.1.0",
      latest_version: "0.1.0",
      platform: "win",
      has_update: false,
      force_update: false
    }), { status: 200 }));
    Object.defineProperty(window, "niuniu", {
      configurable: true,
      value: {
        appName: "NiuNiu",
        checkForInstallerUpdate,
        getAppVersion: async () => ({ isPackaged: false, version: "0.1.0" }),
        getMachineCode: async () => ({ machineCode: "NN-EXISTING", version: "win-v1" }),
        onUpdateStatus: vi.fn(() => () => undefined)
      }
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole("button", { name: "关于牛牛开盘" }));
    expect(screen.getByRole("dialog", { name: "关于牛牛开盘" })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "0.1.0" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(await screen.findByText("当前已是最新版本。")).toBeInTheDocument();
    expect(checkForInstallerUpdate).not.toHaveBeenCalled();
  });

  it("does not open updater or download when the published version is not newer", async () => {
    const checkForInstallerUpdate = vi.fn(async () => ({ appVersion: "0.2.3", phase: "not-available" }));
    const downloadInstallerUpdate = vi.fn(async () => {
      throw new Error("Please check update first");
    });
    Object.defineProperty(window, "niuniu", {
      configurable: true,
      value: {
        appName: "NiuNiu",
        checkForInstallerUpdate,
        downloadInstallerUpdate,
        getAppVersion: async () => ({ isPackaged: true, version: "0.2.3" }),
        getMachineCode: async () => ({ machineCode: "NN-EXISTING", version: "win-v1" }),
        onUpdateStatus: vi.fn(() => () => undefined)
      }
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      current_version: "0.2.3",
      latest_version: "0.2.2",
      platform: "win",
      has_update: true,
      force_update: true,
      download_url: "https://example.com/electron_niuniu-0.2.2.exe",
      release_notes_markdown: "older release"
    }), { status: 200 })));

    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    await userEvent.click(await screen.findByRole("button", { name: "关于牛牛开盘" }));
    await userEvent.click(await screen.findByRole("button", { name: "0.2.3" }));

    expect(await screen.findByText("当前已是最新版本。")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "版本更新" })).not.toBeInTheDocument();
    expect(checkForInstallerUpdate).not.toHaveBeenCalled();
    expect(downloadInstallerUpdate).not.toHaveBeenCalled();
    expect(screen.queryByText("Please check update first")).not.toBeInTheDocument();
  });

  it("locks a forced update modal and renders installer download progress", async () => {
    let updateListener: ((status: { appVersion: string; phase: string; progress?: { bytesPerSecond: number; percent: number; total: number; transferred: number } }) => void) | null = null;
    const checkForInstallerUpdate = vi.fn(async () => ({ appVersion: "0.1.0", phase: "available", info: { version: "0.2.0" } }));
    const downloadInstallerUpdate = vi.fn(async () => {
      updateListener?.({
        appVersion: "0.1.0",
        phase: "downloading",
        progress: {
          bytesPerSecond: 2048,
          percent: 42,
          total: 10485760,
          transferred: 4404019
        }
      });
      return {
        appVersion: "0.1.0",
        phase: "downloading",
        progress: {
          bytesPerSecond: 2048,
          percent: 42,
          total: 10485760,
          transferred: 4404019
        }
      };
    });
    Object.defineProperty(window, "niuniu", {
      configurable: true,
      value: {
        appName: "NiuNiu",
        checkForInstallerUpdate,
        downloadInstallerUpdate,
        getAppVersion: async () => ({ isPackaged: false, version: "0.1.0" }),
        getMachineCode: async () => ({ machineCode: "NN-EXISTING", version: "win-v1" }),
        installInstallerUpdate: vi.fn(),
        onUpdateStatus: vi.fn((listener) => {
          updateListener = listener;
          return () => undefined;
        }),
        windowControl: vi.fn()
      }
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      current_version: "0.1.0",
      latest_version: "0.2.0",
      platform: "win",
      has_update: true,
      force_update: true,
      download_url: "https://example.com/electron_niuniu-0.2.0-setup.exe",
      file_size: 10485760,
      release_notes_markdown: "## 更新内容\n- 验证强制更新弹窗"
    }), { status: 200 })));

    render(
      <MemoryRouter initialEntries={["/overview"]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(await screen.findByRole("dialog", { name: "版本更新" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "稍后再说" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭窗口" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "立即更新" }));

    expect(downloadInstallerUpdate).toHaveBeenCalled();
    expect(checkForInstallerUpdate).toHaveBeenCalledWith("https://example.com/electron_niuniu-0.2.0-setup.exe");
    expect(await screen.findByText("42%")).toBeInTheDocument();
    expect(screen.getByText("2.0 KB/s")).toBeInTheDocument();
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
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const requestUrl = String(url);
    if (!requestUrl.includes("/api/v1/access/trial/apply") && !requestUrl.includes("/api/v1/access/activate")) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response(JSON.stringify({
    access_id: accessId,
    access_type: accessType,
    access_role: accessId.includes("admin") ? "admin" : "user",
    activated_at: "2026-05-17T02:00:00Z",
    activation_secret: "activation-secret",
    machine_code: "NN-TEST-MACHINE",
    machine_code_version: "win-v1",
    quotas: {
      ask_ai: { limit: accessType === "trial" ? 2 : 5, remaining: accessType === "trial" ? 2 : 5, used: 0 },
      auction: { limit: accessType === "trial" ? 2 : 5, remaining: accessType === "trial" ? 2 : 5, used: 0 },
      limit_review: { limit: accessType === "trial" ? 2 : 5, remaining: accessType === "trial" ? 2 : 5, used: 0 }
    }
  }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
