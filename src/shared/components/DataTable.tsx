import clsx from "clsx";
import type { CSSProperties, ReactNode } from "react";
import { changeClass, changeTone } from "../../core/format/market";

export type DataColumn = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  tone?: "change" | "plain";
  variant?: "change" | "plain" | "status" | "stock";
  width?: number;
};

export type DataRow = {
  id: string;
  values: Record<string, ReactNode>;
  onClick?: () => void;
};

export function DataTable({ columns, rows }: { columns: DataColumn[]; rows: DataRow[] }) {
  const displayColumns = normalizeColumns(columns);
  const rowClass = `rows-${Math.min(rows.length, 12)}`;
  const densityClass = rows.length <= 3 ? "density-sparse" : rows.length >= 12 ? "density-dense" : "density-comfortable";
  const template = displayColumns
    .map((column) => {
      if (column.width) return `${column.width}px`;
      if (column.variant === "stock") return "minmax(176px, 1.25fr)";
      if (column.align === "right" || column.variant === "change" || column.tone === "change") return "minmax(112px, .88fr)";
      if (/message|reason|description|备注|原因|消息/.test(`${column.key}${column.label}`)) return "minmax(220px, 1.45fr)";
      if (/date|time|日期|时间|started|created|updated/.test(`${column.key}${column.label}`)) return "minmax(154px, 1fr)";
      return "minmax(120px, 1fr)";
    })
    .join(" ");
  return (
    <div className={clsx("data-table", rowClass, densityClass)} style={{ "--table-template": template } as CSSProperties}>
      <div className="data-table-head">
        {displayColumns.map((column) => (
          <div className={clsx("cell", `align-${column.align ?? "left"}`)} key={column.key}>
            {column.label}
          </div>
        ))}
      </div>
      <div className="data-table-body">
        {rows.map((row) => (
          <button className={clsx("data-row", rowToneClass(displayColumns, row.values))} key={row.id} onClick={row.onClick} type="button">
            {displayColumns.map((column) => {
              const value = row.values[column.key] ?? "--";
              return renderCell(column, row.values, value);
            })}
          </button>
        ))}
      </div>
    </div>
  );
}

function normalizeColumns(columns: DataColumn[]): DataColumn[] {
  const hasCodeName = columns.some((column) => column.key === "code") && columns.some((column) => column.key === "name");
  const hasStockCodeName = columns.some((column) => column.key === "stock_code") && columns.some((column) => column.key === "stock_name");
  const collapsed = hasStockCodeName
    ? new Set(["stock_code", "stock_name", ...(hasCodeName ? ["code", "name"] : [])])
    : hasCodeName
      ? new Set(["code", "name"])
      : new Set<string>();

  if (collapsed.size === 0) {
    return columns;
  }

  let insertedStock = false;
  return columns.flatMap((column) => {
    if (!collapsed.has(column.key)) {
      return [column];
    }
    if (insertedStock) {
      return [];
    }
    insertedStock = true;
    return [{ align: "left" as const, key: "__stock", label: "股票", variant: "stock" as const }];
  });
}

function renderCell(column: DataColumn, values: Record<string, ReactNode>, value: ReactNode) {
  const align = column.align ?? "left";
  const isChangeColumn = column.variant === "change" || column.tone === "change";
  if (column.variant === "stock") {
    const code = cellText(values.stock_code ?? values.code ?? values.symbol ?? value);
    const name = cellText(values.stock_name ?? values.name ?? values.stock ?? values.short_name);
    return (
      <span className={clsx("cell", `align-${align}`, "stock-cell")} key={column.key} title={[code, name].filter(Boolean).join(" ")}>
        <span className="stock-code">{code || "--"}</span>
        <span className="stock-name">{name || "--"}</span>
      </span>
    );
  }

  if (column.variant === "status") {
    const label = statusLabel(value);
    return (
      <span className={clsx("cell", `align-${align}`, "status-cell")} key={column.key}>
        <span className={clsx("status-chip", statusClass(value))}>{label}</span>
      </span>
    );
  }

  return (
    <span className={clsx("cell", `align-${align}`, isChangeColumn && "change-cell", isChangeColumn && `tone-${changeTone(value)}`, isChangeColumn && changeClass(value))} key={column.key} title={cellText(value) || undefined}>
      {value}
    </span>
  );
}

function rowToneClass(columns: DataColumn[], values: Record<string, ReactNode>): string {
  const changeColumns = columns.filter((column) => column.variant === "change" || column.tone === "change");
  const tone = changeColumns.map((column) => changeTone(values[column.key])).find((item) => item !== "neutral") ?? (changeColumns.length > 0 ? "neutral" : "");
  return tone ? `row-${tone}` : "";
}

function statusClass(value: ReactNode): string {
  const text = cellText(value).toLowerCase();
  const positive = new Set(["sealed", "healthy", "running", "ready", "enabled", "success", "completed", "true", "ok"]);
  const negative = new Set(["broken", "failed", "error", "stopped", "disabled", "false", "not ready"]);
  const warning = new Set(["pending", "queued", "warning", "skipped", "unknown"]);
  if (/封板|成功|健康|运行中|启用|完成/.test(text) || positive.has(text)) {
    return "status-up";
  }
  if (/炸板|失败|异常|跌停|停用|不可用/.test(text) || negative.has(text)) {
    return "status-down";
  }
  if (/等待|未运行|跳过|警告/.test(text) || warning.has(text)) {
    return "status-warning";
  }
  return "status-neutral";
}

function statusLabel(value: ReactNode): string {
  const text = cellText(value);
  const normalized = text.toLowerCase();
  const labels: Record<string, string> = {
    broken: "炸板",
    completed: "完成",
    disabled: "停用",
    enabled: "启用",
    failed: "失败",
    false: "否",
    healthy: "健康",
    ok: "正常",
    pending: "等待",
    queued: "排队",
    ready: "就绪",
    running: "运行中",
    sealed: "封板",
    skipped: "跳过",
    stopped: "停止",
    success: "成功",
    true: "是",
    unknown: "未知",
    warning: "警告"
  };
  return labels[normalized] ?? text;
}

function cellText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}
