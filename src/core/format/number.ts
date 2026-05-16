export function formatNumber(value: unknown, digits = 2): string {
  const number = toNumber(value);
  if (number === null) {
    return "--";
  }
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(number) ? 0 : Math.min(digits, 1)
  }).format(number);
}

export function formatPercent(value: unknown, digits = 2): string {
  const number = toNumber(value);
  if (number === null) {
    return "--";
  }
  return `${number > 0 ? "+" : ""}${formatNumber(number, digits)}%`;
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/[%+,，\s]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
