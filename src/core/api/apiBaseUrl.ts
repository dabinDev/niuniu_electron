export const defaultApiBaseUrl = import.meta.env.VITE_API_BASE_URL || "https://niuniu.cylonai.cn";

export function normalizeApiBaseUrl(value?: string | null): string {
  const trimmed = value?.trim() ?? "";
  return (trimmed.length === 0 ? defaultApiBaseUrl : trimmed).replace(/\/+$/, "");
}
