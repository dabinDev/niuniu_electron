import type { AccessActivation } from "./preferencesStore";

export type NavigationItem = {
  path: string;
  mark: string;
  label: string;
  shortcut: string;
  description: string;
};

export const navigationItems: NavigationItem[] = [
  { path: "/overview", mark: "总", label: "盘面总览", shortcut: "F1", description: "情绪温度、赚钱效应和风险雷达" },
  { path: "/auction", mark: "竞", label: "开盘竞价", shortcut: "F2", description: "竞价强弱、开盘候选和异动排序" },
  { path: "/board-tier", mark: "梯", label: "连板天梯", shortcut: "F3", description: "高度梯队、晋级路径和断板观察" },
  { path: "/board-height", mark: "高", label: "高度周期", shortcut: "F4", description: "空间高度、周期拐点和高标明细" },
  { path: "/limit-review", mark: "复", label: "涨停复盘", shortcut: "F5", description: "涨停结构、封板质量和次日锚点" },
  { path: "/plate-rotation", mark: "板", label: "板块轮动", shortcut: "F6", description: "题材强度、轮动节奏和龙头预览" },
  { path: "/node", mark: "节", label: "市场节点", shortcut: "F7", description: "指数节点、板块联动和关键龙头" },
  { path: "/market-center", mark: "行", label: "行情中心", shortcut: "F8", description: "市场表格、空头反馈与交易日切换" },
  { path: "/news", mark: "讯", label: "消息资讯", shortcut: "F10", description: "7x24 快讯、热榜、日历和月份规律" },
  { path: "/ask-ai", mark: "智", label: "策略问答", shortcut: "F11", description: "复盘上下文、策略问答和历史记录" },
  { path: "/jobs", mark: "任", label: "任务中心", shortcut: "F12", description: "管理员采集任务、服务状态和手动触发" }
];

export function canAccessAdminTools(access?: Pick<AccessActivation, "accessRole"> | null): boolean {
  return access?.accessRole === "admin" || access?.accessRole === "owner" || access?.accessRole === "operator";
}

export function visibleNavigationItems(access?: Pick<AccessActivation, "accessRole"> | null): NavigationItem[] {
  return navigationItems.filter((item) => item.path !== "/jobs" || canAccessAdminTools(access));
}
