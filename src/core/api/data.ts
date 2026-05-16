import type { DataColumn, DataRow } from "../../shared/components/DataTable";

export type AnyRecord = Record<string, unknown>;

export function asRecord(value: unknown): AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as AnyRecord) : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asRecords(value: unknown): AnyRecord[] {
  return asArray(value).map(asRecord).filter((item) => Object.keys(item).length > 0);
}

export function getRecord(record: AnyRecord, key: string): AnyRecord {
  return asRecord(record[key]);
}

export function getRecords(record: AnyRecord, key: string): AnyRecord[] {
  return asRecords(record[key]);
}

export function getString(record: AnyRecord, key: string, fallback = "--"): string {
  const value = record[key];
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

export function getOptionalString(record: AnyRecord, key: string): string | undefined {
  const value = record[key];
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  return String(value);
}

export function getNumber(record: AnyRecord, key: string): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[,%]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function getStringList(record: AnyRecord, key: string): string[] {
  return asArray(record[key]).map((item) => String(item));
}

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function toColumns(section: AnyRecord): DataColumn[] {
  const defs = asRecords(section.column_defs ?? section.columns_defs);
  if (defs.length > 0) {
    return defs.map((column) => ({
      align: normalizeAlign(getString(column, "align", "left")),
      key: getString(column, "key"),
      label: resolveColumnLabel(getString(column, "key"), getOptionalString(column, "label")),
      tone: isChangeKey(getString(column, "key")) ? "change" : "plain",
      variant: inferColumnVariant(getString(column, "key")),
      width: getNumber(column, "width")
    }));
  }
  return asArray(section.columns).map((column) => {
    const key = String(column);
    return {
      align: isNumericKey(key) ? "right" : "left",
      key,
      label: columnLabel(key),
      tone: isChangeKey(key) ? "change" : "plain",
      variant: inferColumnVariant(key)
    };
  });
}

export function toRows(section: AnyRecord, columns: DataColumn[]): DataRow[] {
  const itemRows = asRecords(section.items);
  if (itemRows.length > 0) {
    return itemRows.map((item, index) => {
      const cells = asArray(item.cells).map((cell) => String(cell));
      return {
        id: `${getString(section, "key", "section")}-item-${index}`,
        values: Object.fromEntries(columns.map((column, columnIndex) => [column.key, stringifyCell(item[column.key] ?? cells[columnIndex] ?? "--")]))
      };
    });
  }

  return asArray(section.rows).map((rawRow, index) => {
    const cells = asArray(rawRow).map((cell) => String(cell));
    return {
      id: `${getString(section, "key", "section")}-row-${index}`,
      values: Object.fromEntries(columns.map((column, columnIndex) => [column.key, stringifyCell(cells[columnIndex] ?? "--")]))
    };
  });
}

export function recordListToTable(items: AnyRecord[], preferredKeys: string[] = []): { columns: DataColumn[]; rows: DataRow[] } {
  const keys = preferredKeys.length > 0 ? preferredKeys : Array.from(new Set(items.flatMap((item) => Object.keys(item)))).slice(0, 8);
  const columns = keys.map((key) => ({
    align: isNumericKey(key) ? "right" : "left",
    key,
    label: columnLabel(key),
    tone: isChangeKey(key) ? "change" : "plain",
    variant: inferColumnVariant(key)
  })) satisfies DataColumn[];
  const rows = items.map((item, index) => ({
    id: `${getString(item, "code", getString(item, "stock_code", String(index)))}-${index}`,
    values: Object.fromEntries(keys.map((key) => [key, stringifyCell(item[key])]))
  }));
  return { columns, rows };
}

export function tablesToSheets(tables: AnyRecord[]): Array<{ name: string; rows: string[][] }> {
  return tables.map((table) => {
    const columns = toColumns(table);
    const rows = toRows(table, columns);
    return {
      name: getString(table, "title", getString(table, "key", "数据表")),
      rows: [columns.map((column) => column.label), ...rows.map((row) => columns.map((column) => stringifyCell(row.values[column.key])))]
    };
  });
}

export function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function snapshotText(title: string, payload: unknown): string {
  return `${title}\n${JSON.stringify(payload, null, 2)}`;
}

function normalizeAlign(value: string): "center" | "left" | "right" {
  return value === "center" || value === "right" ? value : "left";
}

function isNumericKey(key: string): boolean {
  return /pct|price|amount|count|rank|rate|height|total|score|value|volume|cap|ratio|change|duration|rows/i.test(key);
}

function isChangeKey(key: string): boolean {
  return /change|pct|zhangfu|涨跌|涨幅|跌幅/i.test(key);
}

function inferColumnVariant(key: string): DataColumn["variant"] {
  if (/status|health|enabled|running|ready|trigger_allowed/i.test(key)) {
    return "status";
  }
  if (isChangeKey(key)) {
    return "change";
  }
  return "plain";
}

export function columnLabel(key: string): string {
  const labels: Record<string, string> = {
    action: "动作",
    amount: "成交额",
    amount_text: "成交额",
    amount_yi: "成交额",
    bid_amount: "竞价金额",
    bid_amount_wan: "竞价金额",
    bid_change_pct: "竞价涨幅",
    board: "连板",
    board_count: "连板数",
    board_height: "连板高度",
    board_text: "连板",
    break_count: "炸板",
    change_pct: "涨跌幅",
    code: "代码",
    concept: "概念",
    current_change_pct: "当前涨幅",
    enabled: "启用",
    first_limit_time: "首封",
    final_limit_time: "最终封板",
    float_market_cap_yi: "实际流通",
    full_name: "全称",
    health: "健康",
    height: "高度",
    industry: "行业",
    industry_name: "行业",
    job_code: "任务代码",
    lianban_text: "连板",
    latest_change_pct: "最新涨幅",
    latest_price: "最新价",
    latest_strength: "最新强度",
    latest_strength_text: "最新强度",
    latest_zt: "涨停数",
    limit_time: "封板时间",
    name: "名称",
    plate_code: "板块代码",
    plate_name: "板块",
    pre_close_price: "昨收价",
    price: "价格",
    rank: "排名",
    rank_no: "排名",
    reason: "原因",
    region: "地域",
    run_id: "运行编号",
    score: "评分",
    schedule_mode: "调度方式",
    started_at: "开始时间",
    status: "状态",
    stock_code: "代码",
    stock_name: "名称",
    stock_limit: "股票上限",
    strength: "强度",
    strength_text: "强度",
    success_rate: "成功率",
    success_rate_text: "成功率",
    symbol: "代码",
    time: "时间",
    today_broken_board: "今日炸板",
    today_limit_down: "今日跌停",
    total: "数量",
    total_amount: "总成交额",
    trade_date: "交易日",
    turnover_rate: "换手率",
    open_change_pct: "开盘涨幅",
    duration_ms: "耗时",
    enabled_jobs: "启用任务",
    failed_jobs: "失败任务",
    generated_at: "生成时间",
    healthy_jobs: "健康任务",
    last_rows_written: "最近写入",
    last_started_at: "最近开始",
    last_status: "最近状态",
    message: "消息",
    rows_written: "写入行数",
    total_jobs: "任务总数",
    trigger_allowed: "允许触发",
    yesterday_broken_board: "昨日炸板反馈",
    yesterday_limit_down: "昨日跌停反馈",
    zt: "涨停",
    zt_count: "涨停数"
  };
  return labels[key] ?? key.split("_").map((word) => backendTokenLabels[word.toLowerCase()] ?? word).join("");
}

export function resolveColumnLabel(key: string, label?: string): string {
  const normalizedKey = key.trim();
  const rawLabel = label?.trim() ?? "";
  if (rawLabel && /[\u3400-\u9fff]/.test(rawLabel)) {
    return rawLabel;
  }

  const translatedKey = columnLabel(normalizedKey || rawLabel);
  if (translatedKey && translatedKey !== normalizedKey) {
    return translatedKey;
  }

  if (rawLabel) {
    const labelKey = rawLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const translatedLabel = columnLabel(labelKey);
    if (translatedLabel && translatedLabel !== labelKey) {
      return translatedLabel;
    }
  }

  return translatedKey || rawLabel || "字段";
}

const backendTokenLabels: Record<string, string> = {
  backend: "后端",
  broken: "炸板",
  custom: "自定义",
  key: "字段",
  limit: "跌停",
  down: "",
  board: "",
  yesterday: "昨日",
  today: "今日"
};
