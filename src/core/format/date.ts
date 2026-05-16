export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function displayDate(value?: string | null): string {
  if (!value) {
    return "最新交易日";
  }
  return value.slice(0, 10);
}

export function displayDateTime(value?: string | null): string {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit"
  }).format(date);
}
