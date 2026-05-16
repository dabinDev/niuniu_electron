export const defaultApiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:18081";

export function normalizeApiBaseUrl(value?: string | null): string {
  const trimmed = value?.trim() ?? "";
  return (trimmed.length === 0 ? defaultApiBaseUrl : trimmed).replace(/\/+$/, "");
}
