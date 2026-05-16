export type NavigationItem = {
  path: string;
  mark: string;
  label: string;
  shortcut: string;
  description: string;
};

export const navigationItems: NavigationItem[] = [
  { path: "/overview", mark: "总", label: "总览", shortcut: "F1", description: "市场温度、任务健康和核心数据概览" },
  { path: "/auction", mark: "竞", label: "牛牛竞价", shortcut: "F2", description: "竞价股池、历史列和竞价 AI 结论" },
  { path: "/node", mark: "节", label: "牛牛节点", shortcut: "F3", description: "指数 K 线、板块联动和龙头预览" },
  { path: "/market-center", mark: "行", label: "行情中心", shortcut: "F4", description: "市场表格、空头反馈与交易日切换" },
  { path: "/board-tier", mark: "梯", label: "连板天梯", shortcut: "F6", description: "按连板高度分组的个股天梯" },
  { path: "/board-height", mark: "高", label: "连板高度", shortcut: "F7", description: "高度曲线、日柱和高标明细" },
  { path: "/limit-review", mark: "复", label: "涨停复盘", shortcut: "F8", description: "涨停股池、强弱结构和 AI 复盘" },
  { path: "/plate-rotation", mark: "板", label: "板块轮动", shortcut: "F9", description: "板块强度矩阵和龙头预览" },
  { path: "/news", mark: "讯", label: "牛牛资讯", shortcut: "F10", description: "热点、快讯、日历和月份规律" },
  { path: "/ask-ai", mark: "AI", label: "问 AI", shortcut: "F11", description: "复盘上下文、AI 问答和历史记录" },
  { path: "/jobs", mark: "任", label: "任务中心", shortcut: "F12", description: "服务状态、抓取任务和手动触发" }
];
