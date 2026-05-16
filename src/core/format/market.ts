import { toNumber } from "./number";

export function changeTone(value: unknown): "down" | "neutral" | "up" {
  const number = toNumber(value);
  if (number === null || number === 0) {
    return "neutral";
  }
  return number > 0 ? "up" : "down";
}

export function changeClass(value: unknown): string {
  const tone = changeTone(value);
  return tone === "up" ? "text-up" : tone === "down" ? "text-down" : "";
}

export function firstDefined<T>(...values: Array<T | null | undefined>): T | undefined {
  return values.find((value) => value !== null && value !== undefined);
}

export function formatLimitUpCountLabel(value: unknown): string {
  const count = parseStrictCount(value);
  if (count === null || count < 0 || count > 300) {
    return "--";
  }
  return String(count);
}

function parseStrictCount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) && Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  if (!normalized || normalized.includes("%") || normalized.includes(".")) {
    return null;
  }
  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
