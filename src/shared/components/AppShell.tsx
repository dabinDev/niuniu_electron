import { ReactNode, useEffect, useMemo, useState } from "react";
import { Bell, Minus, PanelLeftClose, PanelLeftOpen, Settings, Square, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { navigationItems } from "../../app/navigation";
import { usePreferencesStore } from "../../app/preferencesStore";
import { controlWindow, getWindowState, onWindowStateChange, supportsWindowStateBridge, type WindowControlAction, type WindowState } from "../../core/desktop/desktopBridge";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const theme = usePreferencesStore((state) => state.theme);
  const motionEnabled = usePreferencesStore((state) => state.motionEnabled);
  const sidebarCollapsed = usePreferencesStore((state) => state.sidebarCollapsed);
  const inviteAcknowledged = usePreferencesStore((state) => state.inviteAcknowledged);
  const acknowledgeInviteAccess = usePreferencesStore((state) => state.acknowledgeInviteAccess);
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const setMotionEnabled = usePreferencesStore((state) => state.setMotionEnabled);
  const setSidebarCollapsed = usePreferencesStore((state) => state.setSidebarCollapsed);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messageCenterOpen, setMessageCenterOpen] = useState(false);
  const [windowState, setWindowState] = useState<WindowState>({ isFullScreen: false, isMaximized: false });

  const className = useMemo(
    () => [
      "app-root",
      sidebarCollapsed ? "sidebar-collapsed" : "",
      windowState.isMaximized || windowState.isFullScreen ? "window-maximized" : "",
      motionEnabled ? "" : "motion-off"
    ].filter(Boolean).join(" "),
    [motionEnabled, sidebarCollapsed, windowState.isFullScreen, windowState.isMaximized]
  );

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
            <WindowLight action="close" className="light-close" label="关闭窗口" />
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
            onOpenMessageCenter={() => setMessageCenterOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          <main className="main-panel">{children}</main>
        </div>
      </section>

      {settingsOpen ? <SettingsPanel onClose={() => setSettingsOpen(false)} /> : null}
      {messageCenterOpen ? <MessageCenterPanel onClose={() => setMessageCenterOpen(false)} /> : null}
      {!inviteAcknowledged ? <InvitationNoticeDialog onAcknowledge={acknowledgeInviteAccess} /> : null}
    </div>
  );
}

function WindowLight({ action, className, label }: { action: WindowControlAction; className: string; label: string }) {
  const Icon = action === "close" ? X : action === "minimize" ? Minus : Square;
  return (
    <button aria-label={label} className={className} onClick={() => void controlWindow(action)} title={label} type="button">
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

function InvitationNoticeDialog({ onAcknowledge }: { onAcknowledge: (value: { code?: string; mode: "trial" | "invite" }) => void }) {
  const [inviteCode, setInviteCode] = useState("");
  const trimmedInviteCode = inviteCode.trim();

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
          <span>没有邀请码也可以先进入试用模式，后续用户体系上线后部分能力可能需要重新验证。</span>
          <button className="ghost-button" onClick={() => onAcknowledge({ mode: "trial" })} type="button">
            试用体验
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
          <button className="primary-button invite-primary-button" disabled={!trimmedInviteCode} onClick={() => onAcknowledge({ code: trimmedInviteCode, mode: "invite" })} type="button">
            验证并进入
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
