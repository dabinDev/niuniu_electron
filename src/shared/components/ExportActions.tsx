import { Camera, Copy, FileDown, FileSpreadsheet, RefreshCw } from "lucide-react";
import type { RefObject } from "react";
import { useState } from "react";
import { copyImageDataUrl, copyText, saveFile } from "../../core/desktop/desktopBridge";
import { snapshotText } from "../../core/api/data";

export type ExportSheet = {
  name: string;
  rows: string[][];
};

type ExportActionsProps = {
  payload: unknown;
  sheets?: ExportSheet[];
  targetRef?: RefObject<HTMLElement | null>;
  title: string;
  onRefresh?: () => void;
};

export function ExportActions({ onRefresh, payload, sheets = [], targetRef, title }: ExportActionsProps) {
  const [message, setMessage] = useState("");

  async function run(action: () => Promise<string>) {
    try {
      setMessage(await action());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    }
  }

  return (
    <div className="export-actions">
      {onRefresh ? (
        <button className="ghost-button icon-label" onClick={onRefresh} type="button">
          <RefreshCw size={14} />
          刷新
        </button>
      ) : null}
      <button className="ghost-button icon-label" onClick={() => run(() => copyText(snapshotText(title, payload)))} type="button">
        <Copy size={14} />
        复制文本
      </button>
      <button
        className="ghost-button icon-label"
        onClick={() =>
          run(async () => {
            if (!targetRef?.current) {
              return "没有可截图区域";
            }
            const { toPng } = await import("html-to-image");
            const target = targetRef.current;
            target.classList.add("export-capture");
            try {
              const dataUrl = await toPng(target, {
                backgroundColor: "#0b0f17",
                cacheBust: true,
                filter: (node) => !(node instanceof HTMLElement && node.classList.contains("export-actions")),
                pixelRatio: 2,
                style: {
                  borderRadius: "24px",
                  padding: "18px"
                }
              });
              return copyImageDataUrl(dataUrl);
            } finally {
              target.classList.remove("export-capture");
            }
          })
        }
        type="button"
      >
        <Camera size={14} />
        复制图片
      </button>
      <button className="ghost-button icon-label" onClick={() => run(() => exportExcel(title, sheets, payload))} type="button">
        <FileSpreadsheet size={14} />
        Excel
      </button>
      <button className="ghost-button icon-label" onClick={() => run(() => exportCsv(title, sheets, payload))} type="button">
        <FileDown size={14} />
        CSV
      </button>
      {message ? <span className="action-message">{message}</span> : null}
    </div>
  );
}

async function exportExcel(title: string, sheets: ExportSheet[], payload: unknown): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const effectiveSheets = sheets.length > 0 ? sheets : [{ name: title, rows: [["数据"], [JSON.stringify(payload)]] }];
  effectiveSheets.forEach((sheet, index) => {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheet.name || `${title}-${index + 1}`));
  });
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return saveFile(`${safeFileName(title)}.xlsx`, new Uint8Array(bytes));
}

async function exportCsv(title: string, sheets: ExportSheet[], payload: unknown): Promise<string> {
  const effectiveSheets = sheets.length > 0 ? sheets : [{ name: title, rows: [["数据"], [JSON.stringify(payload)]] }];
  const content = effectiveSheets
    .map((sheet) => [`# ${sheet.name}`, ...sheet.rows.map((row) => row.map(escapeCsv).join(","))].join("\n"))
    .join("\n\n");
  return saveFile(`${safeFileName(title)}.csv`, content);
}

function escapeCsv(value: string): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sanitizeSheetName(value: string): string {
  return value.replace(/[\\/?*[\]:]/g, "_").slice(0, 31) || "工作表";
}

function safeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
}
