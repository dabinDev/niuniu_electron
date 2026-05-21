import clsx from "clsx";
import { Copy } from "lucide-react";
import { NavLink } from "react-router-dom";
import type { NavigationItem } from "../../app/navigation";
import brandIconUrl from "../../assets/brand/niuniu-client-icon.png";

type SidebarProps = {
  collapsed: boolean;
  machineCode?: string;
  navigationItems: NavigationItem[];
  onCopyMachineCode?: () => void;
  onOpenMessageCenter?: () => void;
  onOpenSettings?: () => void;
  onToggle: () => void;
};

const aiPaths = new Set(["/ask-ai"]);
const navIconClassByPath = new Map([
  ["/overview", "overview"],
  ["/auction", "auction"],
  ["/node", "node"],
  ["/market-center", "market-center"],
  ["/yesterday-stats", "yesterday-stats"],
  ["/board-tier", "board-tier"],
  ["/board-height", "board-height"],
  ["/limit-review", "limit-review"],
  ["/plate-rotation", "plate-rotation"],
  ["/news", "news"],
  ["/ask-ai", "ask-ai"],
  ["/jobs", "jobs"]
]);

export function Sidebar({ collapsed, machineCode, navigationItems, onCopyMachineCode, onOpenMessageCenter, onOpenSettings, onToggle }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-copy">
          <strong>牛牛开盘</strong>
          <span>专业复盘工作台</span>
        </div>
        <div className="brand-mark" aria-label="牛牛开盘品牌标识">
          <img alt="牛牛开盘图标" className="brand-icon-image" src={brandIconUrl} />
        </div>
      </div>
      <div className="sidebar-market-strip" aria-label="短线看盘优先级">
        <div className="market-strip-mark">
          <span>09:25</span>
          <b>竞</b>
        </div>
        {collapsed ? null : (
          <div>
            <b>短线看盘</b>
            <span>竞价 · 梯队 · 题材 · 风险</span>
          </div>
        )}
      </div>

      <button className="collapse-icon" onClick={onToggle} aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"} type="button">
        {collapsed ? "›" : "‹"}
      </button>

      <div className="search-box">搜索股票 / 板块 / 复盘主题</div>

      <nav className="nav-list" aria-label="主导航">
        {navigationItems.map((item) => {
          const aiEnabled = aiPaths.has(item.path);
          return (
          <NavLink
            aria-label={`${item.mark} ${item.label}${aiEnabled ? " AI 分析页" : ""}`}
            className={clsx(aiEnabled && "ai-capable")}
            key={item.path}
            title={collapsed ? `${item.label}${aiEnabled ? " · AI" : ""}` : undefined}
            to={item.path}
          >
            <i className={`nav-icon-mark nav-icon-${navIconClassByPath.get(item.path) ?? "default"}`} aria-hidden="true">
              <span>{item.mark}</span>
            </i>
            {collapsed ? null : <span className="nav-label">{item.label}</span>}
            {collapsed ? null : <small className="nav-shortcut">{item.shortcut}</small>}
            {aiEnabled ? <em>AI</em> : null}
          </NavLink>
          );
        })}
      </nav>

      <div className="quick-actions">
        {machineCode ? (
          <div className="machine-code-card" title={machineCode}>
            <i>码</i>
            {collapsed ? null : (
              <div>
                <b>机器码</b>
                <span>{machineCode}</span>
              </div>
            )}
            <button aria-label="复制机器码" onClick={onCopyMachineCode} type="button">
              <Copy size={14} />
            </button>
          </div>
        ) : null}
        <button className="quick-card" onClick={onOpenMessageCenter} type="button" aria-label="打开消息中心">
          <i>讯</i>
          <div>
            <b>消息中心</b>
            <span>7x24 快讯与公告</span>
          </div>
        </button>
        <button className="quick-card" onClick={onOpenSettings} type="button" aria-label="打开联动设置">
          <i>联</i>
          <div>
            <b>联动设置</b>
            <span>通达信 / 同花顺</span>
          </div>
        </button>
      </div>
    </aside>
  );
}
