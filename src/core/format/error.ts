import { ApiError } from "../api/apiClient";

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return parseApiErrorMessage(error) ?? error.message;
  }
  return error instanceof Error ? error.message : String(error ?? "未知错误");
}

function parseApiErrorMessage(error: ApiError): string | undefined {
  const payload = parseJsonObject(error.responseBody || error.message);
  const directMessage = typeof payload?.message === "string" ? payload.message : undefined;
  if (directMessage) {
    return directMessage;
  }
  const detailRecord = isRecord(payload?.detail) ? payload.detail : undefined;
  const detailMessage = typeof detailRecord?.message === "string" ? detailRecord.message : undefined;
  if (detailMessage) {
    return detailMessage;
  }
  const details = Array.isArray(payload?.detail) ? payload.detail : undefined;
  if (!details || details.length === 0) {
    return undefined;
  }

  const messages = details.map(formatValidationDetail).filter(Boolean);
  if (messages.length === 0) {
    return undefined;
  }
  return `接口参数校验失败：${messages.join("；")}`;
}

function formatValidationDetail(detail: unknown): string {
  if (!isRecord(detail)) {
    return String(detail);
  }
  const loc = Array.isArray(detail.loc) ? detail.loc.map(String).filter((item) => item !== "query" && item !== "body") : [];
  const field = loc.length > 0 ? loc[loc.length - 1] : undefined;
  const message = String(detail.msg ?? "参数不符合要求");
  const input = detail.input === undefined || detail.input === null || detail.input === "" ? "" : `（当前值：${String(detail.input)}）`;
  return `${field ? `${field} ` : ""}${message}${input}`;
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(text) as unknown;
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
