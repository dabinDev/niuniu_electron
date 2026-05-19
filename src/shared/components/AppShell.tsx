import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Copy, Download, Info, Minus, PanelLeftClose, PanelLeftOpen, RefreshCw, Settings, Square, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { navigationItems } from "../../app/navigation";
import { type AccessActivation, usePreferencesStore } from "../../app/preferencesStore";
import { activateAccess, applyTrialAccess } from "../../core/access/accessActivation";
import { ApiClient } from "../../core/api/apiClient";
import { getMachineCodeInfo, type MachineCodeInfo } from "../../core/access/machineCode";
import {
  checkForInstallerUpdate,
  controlWindow,
  copyText,
  downloadInstallerUpdate,
  getAppVersion,
  getWindowState,
  installInstallerUpdate,
  onUpdateStatus,
  onWindowStateChange,
  supportsWindowStateBridge,
  type InstallerUpdateStatus,
  type WindowControlAction,
  type WindowState
} from "../../core/desktop/desktopBridge";
import { errorMessage } from "../../core/format/error";
import { checkLatestAppVersion, type AppVersionCheckResult } from "../../features/appVersion/versionApi";
import { formatBytes, formatSpeed, nextUpdatePhaseLabel, type UpdateModalPhase, updateCanClose } from "../../features/appVersion/updateViewModel";
import { MarkdownContent } from "./MarkdownContent";
import { Sidebar } from "./Sidebar";

type AppVersionInfo = { isPackaged: boolean; version: string };

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const theme = usePreferencesStore((state) => state.theme);
  const motionEnabled = usePreferencesStore((state) => state.motionEnabled);
  const sidebarCollapsed = usePreferencesStore((state) => state.sidebarCollapsed);
  const inviteAcknowledged = usePreferencesStore((state) => state.inviteAcknowledged);
  const accessActivation = usePreferencesStore((state) => state.accessActivation);
  const apiBaseUrl = usePreferencesStore((state) => state.apiBaseUrl);
  const saveAccessActivation = usePreferencesStore((state) => state.saveAccessActivation);
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const setMotionEnabled = usePreferencesStore((state) => state.setMotionEnabled);
  const setSidebarCollapsed = usePreferencesStore((state) => state.setSidebarCollapsed);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messageCenterOpen, setMessageCenterOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [machineInfo, setMachineInfo] = useState<MachineCodeInfo | null>(null);
  const [appVersion, setAppVersion] = useState<AppVersionInfo>({ isPackaged: false, version: "0.1.0" });
  const [appVersionLoaded, setAppVersionLoaded] = useState(!window.niuniu?.getAppVersion);
  const [updateCheck, setUpdateCheck] = useState<AppVersionCheckResult | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [installerStatus, setInstallerStatus] = useState<InstallerUpdateStatus>({ appVersion: "0.1.0", phase: "idle" });
  const [updateStatusText, setUpdateStatusText] = useState("");
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [windowState, setWindowState] = useState<WindowState>({ isFullScreen: false, isMaximized: false });
  const autoCheckedVersionRef = useRef<string | null>(null);
  const installRequestedRef = useRef(false);
  const apiClient = useMemo(
    () => new ApiClient({ accessProvider: () => accessActivation, baseUrl: apiBaseUrl }),
    [accessActivation, apiBaseUrl]
  );

  const className = useMemo(
    () => [
      "app-root",
      sidebarCollapsed ? "sidebar-collapsed" : "",
      windowState.isMaximized || windowState.isFullScreen ? "window-maximized" : "",
      motionEnabled ? "" : "motion-off"
    ].filter(Boolean).join(" "),
    [motionEnabled, sidebarCollapsed, windowState.isFullScreen, windowState.isMaximized]
  );
  const forcedUpdateLocked = Boolean(updateModalOpen && updateCheck?.forceUpdate);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || isTextInput(event.target) || isTextInput(document.activeElement)) {
        return;
      }
      const item = navigationItems.find((entry) => entry.shortcut === event.key);
      if (!item) {
        return;
      }
      event.preventDefault();
      navigate(item.path);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  useEffect(() => {
    if (!supportsWindowStateBridge()) {
      return undefined;
    }
    let mounted = true;
    void getWindowState().then((state) => {
      if (mounted) {
        setWindowState(state);
      }
    });
    const unsubscribe = onWindowStateChange((state) => setWindowState(state));
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (accessActivation?.machineCode) {
      setMachineInfo({ machineCode: accessActivation.machineCode, version: accessActivation.machineCodeVersion });
      return undefined;
    }
    let mounted = true;
    void getMachineCodeInfo().then((info) => {
      if (mounted) {
        setMachineInfo(info);
      }
    });
    return () => {
      mounted = false;
    };
  }, [accessActivation?.machineCode, accessActivation?.machineCodeVersion]);

  const requestInstallUpdate = useCallback(async () => {
    if (installRequestedRef.current) {
      return;
    }
    installRequestedRef.current = true;
    await installInstallerUpdate();
  }, []);

  useEffect(() => {
    if (!window.niuniu?.getAppVersion) {
      setAppVersionLoaded(true);
      return undefined;
    }
    let mounted = true;
    void getAppVersion().then((version) => {
      if (mounted) {
        setAppVersion(version);
        setAppVersionLoaded(true);
        setInstallerStatus((status) => ({ ...status, appVersion: version.version }));
      }
    }).catch(() => {
      if (mounted) {
        setAppVersionLoaded(true);
      }
    });
    const unsubscribe = onUpdateStatus((status) => {
      setInstallerStatus(status);
      if (status.phase === "error") {
        setUpdateStatusText(status.error || "更新失败，请稍后重试。");
      }
      if (status.phase === "downloaded") {
        void requestInstallUpdate();
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [requestInstallUpdate]);

  const runVersionCheck = useCallback(async (source: "auto" | "manual" = "manual") => {
    if (!accessActivation) {
      if (source === "manual") {
        setUpdateStatusText("请先完成体验码或邀请码激活，再检查版本更新。");
      }
      return;
    }
    if (!appVersionLoaded) {
      if (source === "manual") {
        setUpdateStatusText("正在读取当前版本，请稍后再试。");
      }
      return;
    }
    setCheckingUpdate(true);
    setUpdateStatusText(source === "manual" ? "正在检查更新..." : "");
    try {
      const current = appVersion.version || "0.1.0";
      const result = await checkLatestAppVersion({ client: apiClient, currentVersion: current });
      setUpdateCheck(result);
      if (result.hasUpdate) {
        setInstallerStatus({ appVersion: current, phase: "available", info: { version: result.latestVersion } });
        setUpdateModalOpen(true);
        setUpdateStatusText("");
      } else {
        setUpdateCheck(null);
        setUpdateModalOpen(false);
        setInstallerStatus({ appVersion: current, phase: "not-available" });
        if (source === "manual") {
          setUpdateStatusText("当前已是最新版本。");
        }
      }
    } catch (error) {
      if (source === "manual") {
        setUpdateStatusText(errorMessage(error));
      }
    } finally {
      setCheckingUpdate(false);
    }
  }, [accessActivation, apiClient, appVersion.version, appVersionLoaded]);

  const runDownloadUpdate = useCallback(async () => {
    setUpdateStatusText("");
    if (!updateCheck?.hasUpdate || !updateCheck.downloadUrl.trim()) {
      setInstallerStatus({ appVersion: appVersion.version, phase: "not-available" });
      setUpdateStatusText("请先检查到可用更新后再下载。");
      return;
    }
    installRequestedRef.current = false;
    setInstallerStatus((status) => ({
      appVersion: status.appVersion || appVersion.version,
      phase: "downloading",
      progress: "progress" in status ? status.progress : { bytesPerSecond: 0, percent: 0, total: updateCheck?.fileSize ?? 0, transferred: 0 }
    }));
    try {
      await checkForInstallerUpdate(updateCheck?.downloadUrl);
      const status = await downloadInstallerUpdate();
      setInstallerStatus(status);
      if (status.phase === "downloaded") {
        await requestInstallUpdate();
      }
    } catch (error) {
      setInstallerStatus({ appVersion: appVersion.version, error: errorMessage(error), phase: "error" });
      setUpdateStatusText(errorMessage(error));
    }
  }, [appVersion.version, requestInstallUpdate, updateCheck]);

  useEffect(() => {
    if (!window.niuniu?.getAppVersion || !accessActivation || !appVersionLoaded || !appVersion.version || autoCheckedVersionRef.current === appVersion.version) {
      return;
    }
    autoCheckedVersionRef.current = appVersion.version;
    void runVersionCheck("auto");
  }, [accessActivation, appVersion.version, appVersionLoaded, runVersionCheck]);

  return (
    <div className={className} data-theme={theme}>
      <div className="backdrop" aria-hidden="true">
        <div className="aura aura-one" />
        <div className="aura aura-two" />
        <div className="aura aura-three" />
      </div>

      <section className="window-shell">
        <header className="titlebar">
          <div className="window-lights">
            <WindowLight action="close" className="light-close" disabled={forcedUpdateLocked} label="关闭窗口" />
            <WindowLight action="minimize" className="light-min" label="最小化窗口" />
            <WindowLight action="toggle-maximize" className="light-max" label="最大化或还原窗口" />
          </div>
          <div className="window-title">牛牛开盘 · 复盘工作室</div>
          <div className="title-actions">
            <button className="ghost-button sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} type="button">
              {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
              {sidebarCollapsed ? "展开侧栏" : "折叠侧栏"}
            </button>
            <button className="pill-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} type="button">
              <span className="switch">
                <span />
              </span>
              {theme === "dark" ? "深色" : "浅色"}
            </button>
            <button className="ghost-button" onClick={() => setMotionEnabled(!motionEnabled)} type="button">
              {motionEnabled ? "动效开" : "动效关"}
            </button>
            <button className="icon-button" onClick={() => setMessageCenterOpen(true)} title="消息中心" type="button">
              <Bell size={15} />
            </button>
            <button aria-label="关于牛牛开盘" className="icon-button" onClick={() => setAboutOpen(true)} title="关于牛牛开盘" type="button">
              <Info size={15} />
            </button>
            <button className="icon-button" onClick={() => setSettingsOpen(true)} title="设置" type="button">
              <Settings size={15} />
            </button>
            <span className="sync-state">
              <i />
              实时同步中
            </span>
          </div>
        </header>

        <div className="app-layout">
          <Sidebar
            collapsed={sidebarCollapsed}
            machineCode={machineInfo?.machineCode ?? accessActivation?.machineCode}
            onCopyMachineCode={() => {
              const value = machineInfo?.machineCode ?? accessActivation?.machineCode ?? "";
              if (value) {
                void copyText(value);
              }
            }}
            onOpenMessageCenter={() => setMessageCenterOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          <main className="main-panel">{children}</main>
        </div>
      </section>

      {settingsOpen ? <SettingsPanel onClose={() => setSettingsOpen(false)} /> : null}
      {messageCenterOpen ? <MessageCenterPanel onClose={() => setMessageCenterOpen(false)} /> : null}
      {aboutOpen ? (
        <AboutDialog
          appVersion={appVersion}
          checking={checkingUpdate}
          machineInfo={machineInfo}
          onCheckUpdate={() => void runVersionCheck("manual")}
          onClose={() => setAboutOpen(false)}
          statusText={updateStatusText}
        />
      ) : null}
      {updateModalOpen && updateCheck ? (
        <UpdateDialog
          check={updateCheck}
          installerStatus={installerStatus}
          onClose={() => setUpdateModalOpen(false)}
          onDownload={() => void runDownloadUpdate()}
          statusText={updateStatusText}
        />
      ) : null}
      {!inviteAcknowledged ? (
        <InvitationNoticeDialog
          apiBaseUrl={apiBaseUrl}
          machineInfo={machineInfo}
          onActivated={saveAccessActivation}
        />
      ) : null}
    </div>
  );
}

function WindowLight({ action, className, disabled = false, label }: { action: WindowControlAction; className: string; disabled?: boolean; label: string }) {
  const Icon = action === "close" ? X : action === "minimize" ? Minus : Square;
  return (
    <button aria-label={label} className={className} disabled={disabled} onClick={() => void controlWindow(action)} title={label} type="button">
      <Icon size={8} strokeWidth={3} />
    </button>
  );
}

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const apiBaseUrl = usePreferencesStore((state) => state.apiBaseUrl);
  const setApiBaseUrl = usePreferencesStore((state) => state.setApiBaseUrl);
  const stockLinkClient = usePreferencesStore((state) => state.stockLinkClient);
  const tdxPath = usePreferencesStore((state) => state.tdxPath);
  const thsPath = usePreferencesStore((state) => state.thsPath);
  const setStockLinkSettings = usePreferencesStore((state) => state.setStockLinkSettings);
  const [draftApi, setDraftApi] = useState(apiBaseUrl);
  const [client, setClient] = useState(stockLinkClient);
  const [draftTdx, setDraftTdx] = useState(tdxPath);
  const [draftThs, setDraftThs] = useState(thsPath);

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-label="客户端设置" className="settings-panel" role="dialog">
        <header className="card-head">
          <b>客户端设置</b>
          <button aria-label="关闭设置" className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
        </header>
        <label className="field-row">
          <span>接口地址</span>
          <input value={draftApi} onChange={(event) => setDraftApi(event.target.value)} />
        </label>
        <div className="field-row">
          <span>联动客户端</span>
          <div className="segmented inline">
            <button className={client === "tdx" ? "on" : ""} onClick={() => setClient("tdx")} type="button">
              通达信
            </button>
            <button className={client === "ths" ? "on" : ""} onClick={() => setClient("ths")} type="button">
              同花顺
            </button>
          </div>
        </div>
        <label className="field-row">
          <span>通达信路径</span>
          <input value={draftTdx} onChange={(event) => setDraftTdx(event.target.value)} placeholder="例如 D:\\tdx\\TdxW.exe" />
        </label>
        <label className="field-row">
          <span>同花顺路径</span>
          <input value={draftThs} onChange={(event) => setDraftThs(event.target.value)} placeholder="例如 D:\\同花顺\\hexin.exe" />
        </label>
        <footer className="settings-actions">
          <button className="ghost-button" onClick={onClose} type="button">
            取消
          </button>
          <button
            className="primary-button"
            onClick={() => {
              setApiBaseUrl(draftApi);
              setStockLinkSettings({ client, tdxPath: draftTdx, thsPath: draftThs });
              onClose();
            }}
            type="button"
          >
            保存设置
          </button>
        </footer>
      </section>
    </div>
  );
}

function AboutDialog({
  appVersion,
  checking,
  machineInfo,
  onCheckUpdate,
  onClose,
  statusText
}: {
  appVersion: AppVersionInfo;
  checking: boolean;
  machineInfo: MachineCodeInfo | null;
  onCheckUpdate: () => void;
  onClose: () => void;
  statusText: string;
}) {
  const machineCode = machineInfo?.machineCode ?? "";

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-label="关于牛牛开盘" className="about-dialog" role="dialog">
        <header className="card-head about-dialog-head">
          <div>
            <span className="card-eyebrow">NIUNIU REVIEW STUDIO</span>
            <b>关于牛牛开盘</b>
          </div>
          <button aria-label="关闭关于" className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
        </header>

        <div className="about-product-row">
          <div className="about-product-mark" aria-hidden="true">牛</div>
          <div>
            <strong>牛牛开盘</strong>
            <span>复盘、竞价与 AI 分析工作台</span>
          </div>
        </div>

        <div className="about-info-grid">
          <article>
            <span>当前版本</span>
            <button className="version-link-button" disabled={checking} onClick={onCheckUpdate} type="button">
              {appVersion.version}
            </button>
          </article>
          <article>
            <span>运行形态</span>
            <b>{appVersion.isPackaged ? "安装版" : "开发预览"}</b>
          </article>
        </div>

        <div className="about-machine-card">
          <span>机器码</span>
          <code>{machineCode || "读取中..."}</code>
          <button aria-label="复制关于页机器码" className="icon-button" disabled={!machineCode} onClick={() => void copyText(machineCode)} title="复制机器码" type="button">
            <Copy size={14} />
          </button>
        </div>

        {statusText ? <p className="about-status-text">{statusText}</p> : null}

        <footer className="settings-actions">
          <button className="ghost-button icon-label" disabled={checking} onClick={onCheckUpdate} type="button">
            <RefreshCw size={14} />
            {checking ? "检查中" : "检查更新"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function UpdateDialog({
  check,
  installerStatus,
  onClose,
  onDownload,
  statusText
}: {
  check: AppVersionCheckResult;
  installerStatus: InstallerUpdateStatus;
  onClose: () => void;
  onDownload: () => void;
  statusText: string;
}) {
  const phase = toUpdateModalPhase(installerStatus.phase);
  const canClose = updateCanClose({ forceUpdate: check.forceUpdate, phase });
  const progress = installerStatus.phase === "downloading" ? installerStatus.progress : null;
  const percent = Math.max(0, Math.min(100, Math.round(progress?.percent ?? 0)));
  const notes = check.releaseNotesMarkdown || check.releaseNotesText || "本次更新暂无详细公告。";

  return (
    <div className={`modal-backdrop update-backdrop${check.forceUpdate ? " locked" : ""}`} role="presentation">
      <section aria-label="版本更新" className="update-dialog" role="dialog">
        <header className="card-head update-dialog-head">
          <div>
            <span className="card-eyebrow">{check.forceUpdate ? "FORCE UPDATE" : "UPDATE AVAILABLE"}</span>
            <b>发现新版本 {check.latestVersion}</b>
            <p>当前版本 {check.currentVersion} · {check.forceUpdate ? "强制更新" : "普通更新"}</p>
          </div>
          {canClose ? (
            <button aria-label="关闭版本更新" className="ghost-button" onClick={onClose} type="button">
              关闭
            </button>
          ) : null}
        </header>

        <div className="version-check-card">
          <span>{nextUpdatePhaseLabel(phase)}</span>
          <b>{phase === "downloading" ? `${percent}%` : check.latestVersion}</b>
        </div>

        <div className="update-release-notes">
          <MarkdownContent value={notes} />
        </div>

        {progress ? (
          <div className="update-progress-card">
            <div className="update-progress-bar" aria-label="下载进度">
              <i className="update-progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="update-progress-meta">
              <span>{formatBytes(progress.transferred)} / {formatBytes(progress.total)}</span>
              <b>{formatSpeed(progress.bytesPerSecond)}</b>
            </div>
          </div>
        ) : null}

        {statusText ? <p className="update-status-text">{statusText}</p> : null}

        <footer className="settings-actions update-actions">
          {canClose ? (
            <button className="ghost-button" onClick={onClose} type="button">
              稍后再说
            </button>
          ) : null}
          <button className="primary-button icon-label" disabled={phase === "downloading" || phase === "installing"} onClick={onDownload} type="button">
            <Download size={15} />
            {phase === "error" ? "重试下载" : "立即更新"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function toUpdateModalPhase(phase: InstallerUpdateStatus["phase"]): UpdateModalPhase {
  if (phase === "idle") {
    return "available";
  }
  return phase;
}

function InvitationNoticeDialog({
  apiBaseUrl,
  machineInfo,
  onActivated
}: {
  apiBaseUrl: string;
  machineInfo: MachineCodeInfo | null;
  onActivated: (value: AccessActivation) => void;
}) {
  const [inviteCode, setInviteCode] = useState("");
  const [statusText, setStatusText] = useState("");
  const [activating, setActivating] = useState(false);
  const trimmedInviteCode = inviteCode.trim();
  const machineCode = machineInfo?.machineCode ?? "";

  async function runActivation(mode: "trial" | "invite") {
    const code = trimmedInviteCode;
    if (!machineInfo || (mode === "invite" && !code)) {
      setStatusText("正在读取机器码，请稍候再试。");
      return;
    }
    setActivating(true);
    setStatusText("");
    try {
      const activation = mode === "trial"
        ? await applyTrialAccess({ apiBaseUrl, machine: machineInfo })
        : await activateAccess({
            accessCode: code,
            apiBaseUrl,
            machine: machineInfo,
            mode
          });
      onActivated(activation);
    } catch (error) {
      setStatusText(errorMessage(error));
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="modal-backdrop invite-notice-backdrop" role="presentation">
      <section aria-label="牛牛开盘使用声明与邀请验证" className="invite-notice-panel" role="dialog">
        <header className="invite-notice-head">
          <div className="invite-notice-mark" aria-hidden="true">
            牛
          </div>
          <div>
            <span className="card-eyebrow">INVITE TRIAL / LEARNING ONLY</span>
            <b>欢迎进入牛牛开盘复盘工作台</b>
            <p>当前版本处于内部邀请试用阶段。请先确认使用边界，再选择试用体验或输入邀请码进入。</p>
          </div>
        </header>

        <div className="invite-notice-grid">
          <article>
            <b>学习研究声明</b>
            <span>本项目仅作学习、研究与数据复盘使用。如涉及权利问题，请联系作者处理。</span>
          </article>
          <article className="risk">
            <b>投资风险声明</b>
            <span>所有功能不构成股票、基金或其他金融产品的投资建议。请保持独立判断，理性看待市场波动。</span>
          </article>
          <article className="ai">
            <b>AI 使用声明</b>
            <span>AI 内容由模型基于数据综合生成，可能存在遗漏、偏差或误读，作者不对 AI 输出及其使用结果负责。</span>
          </article>
          <article>
            <b>决策责任</b>
            <span>任何交易、配置或资金决策均应由使用者自行核验并独立承担结果，本工具只辅助复盘和观察。</span>
          </article>
        </div>

        <div className="invite-trial-row">
          <span>没有邀请码也可以先进入体验模式，系统会自动为当前机器申请一机一码体验资格。</span>
          <button className="ghost-button" disabled={activating || !machineInfo} onClick={() => void runActivation("trial")} type="button">
            {activating ? "申请中" : "试用体验"}
          </button>
        </div>

        <div className="invite-machine-row">
          <span>机器码</span>
          <code>{machineCode || "读取中..."}</code>
          <button aria-label="复制机器码" className="icon-button" disabled={!machineCode} onClick={() => void copyText(machineCode)} type="button">
            <Copy size={14} />
          </button>
        </div>

        <label className="field-row invite-code-field">
          <span>邀请码</span>
          <input
            aria-label="邀请码"
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="请输入内部邀请码"
            value={inviteCode}
          />
        </label>

        <footer className="settings-actions">
          {statusText ? <span className="invite-status-text">{statusText}</span> : null}
          <button className="primary-button invite-primary-button" disabled={activating || !trimmedInviteCode || !machineInfo} onClick={() => void runActivation("invite")} type="button">
            {activating ? "验证中" : "验证并进入"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function MessageCenterPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const notices = [
    { tag: "快讯", title: "7x24 消息中心已接入资讯页", detail: "可在牛牛资讯页继续搜索关键词、筛选重点消息。" },
    { tag: "公告", title: "复盘数据按当前接口实时刷新", detail: "若看到缓存时间滞后，请先检查任务中心采集状态。" },
    { tag: "提醒", title: "AI 页面支持本地限额和个人 Kimi Key", detail: "公共额度触发限制时，可在问 AI 页面展开服务设置。" }
  ];

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-label="消息中心 / 7x24" className="message-center-panel" role="dialog">
        <header className="card-head">
          <div>
            <span className="card-eyebrow">复盘工作室</span>
            <b>消息中心 / 7x24</b>
          </div>
          <button aria-label="关闭消息中心" className="ghost-button" onClick={onClose} type="button">
            关闭
          </button>
        </header>
        <div className="message-center-body">
          {notices.map((notice) => (
            <article key={notice.title}>
              <span>{notice.tag}</span>
              <div>
                <b>{notice.title}</b>
                <p>{notice.detail}</p>
              </div>
            </article>
          ))}
        </div>
        <footer className="settings-actions">
          <button
            className="primary-button"
            onClick={() => {
              onClose();
              navigate("/news");
            }}
            type="button"
          >
            打开牛牛资讯
          </button>
        </footer>
      </section>
    </div>
  );
}
