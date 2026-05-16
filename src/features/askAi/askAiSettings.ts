export type AskAiSettings = {
  apiKey: string;
  dailyLimit: number;
  model: string;
};

export type AskAiUsageStore = Record<string, { count: number; date: string }>;

export type AskAiUsageStatus = {
  canSend: boolean;
  dailyLimit: number;
  isUnlimited: boolean;
  providerLabel: string;
  remaining: number;
  usedToday: number;
};

export type AiFeatureKey = "ask_ai" | "auction" | "limit_review";

export type AiFeatureUsage = {
  canSend: boolean;
  feature: AiFeatureKey;
  isUnlimited: boolean;
  limit: number;
  remaining: number;
  used: number;
};

export const askAiStorageKeys = {
  clientId: "niuniu-ask-ai-client-id",
  settings: "niuniu-ask-ai-settings",
  usage: "niuniu-ask-ai-usage"
} as const;

export function normalizeAskAiSettings(value?: Partial<AskAiSettings> | null): AskAiSettings {
  const apiKey = value?.apiKey?.trim() ?? "";
  return {
    apiKey,
    dailyLimit: Math.max(0, Math.trunc(Number(value?.dailyLimit ?? 0) || 0)),
    model: apiKey ? value?.model?.trim() ?? "" : ""
  };
}

export function loadAskAiSettings(storage: Storage = localStorage): AskAiSettings {
  try {
    const raw = storage.getItem(askAiStorageKeys.settings);
    return normalizeAskAiSettings(raw ? JSON.parse(raw) as Partial<AskAiSettings> : undefined);
  } catch {
    return normalizeAskAiSettings();
  }
}

export function saveAskAiSettings(settings: AskAiSettings, storage: Storage = localStorage): AskAiSettings {
  const normalized = normalizeAskAiSettings(settings);
  storage.setItem(askAiStorageKeys.settings, JSON.stringify(normalized));
  return normalized;
}

export function loadOrCreateAskAiClientId(storage: Storage = localStorage): string {
  const existing = storage.getItem(askAiStorageKeys.clientId)?.trim();
  if (existing) return existing;
  const clientId = `electron-${Date.now()}-${Math.random().toString(16).slice(2, 10).padEnd(8, "0")}`;
  storage.setItem(askAiStorageKeys.clientId, clientId);
  return clientId;
}

export function buildAskAiSyncPayload(settings: AskAiSettings, clientId: string): Record<string, string> {
  const normalized = normalizeAskAiSettings(settings);
  return {
    provider: "kimi",
    client_id: clientId,
    api_key: normalized.apiKey,
    ...(normalized.apiKey && normalized.model ? { model: normalized.model } : {})
  };
}

export function buildAskAiClientConfig(_settings: AskAiSettings, clientId: string): Record<string, string> {
  return {
    provider: "kimi",
    client_id: clientId
  };
}

export function loadAskAiUsageStore(storage: Storage = localStorage): AskAiUsageStore {
  try {
    const raw = storage.getItem(askAiStorageKeys.usage);
    const value = raw ? JSON.parse(raw) as unknown : {};
    return isUsageStore(value) ? value : {};
  } catch {
    return {};
  }
}

export function saveAskAiUsageStore(store: AskAiUsageStore, storage: Storage = localStorage): void {
  storage.setItem(askAiStorageKeys.usage, JSON.stringify(store));
}

export function getAskAiUsageStatus(store: AskAiUsageStore, settings: AskAiSettings, today = todayKey()): AskAiUsageStatus {
  const normalized = normalizeAskAiSettings(settings);
  const usageKey = usageKeyFor(normalized);
  const entry = store[usageKey];
  const usedToday = entry?.date === today ? entry.count : 0;
  const isUnlimited = normalized.dailyLimit <= 0;
  const remaining = isUnlimited ? 999 : Math.max(0, normalized.dailyLimit - usedToday);
  return {
    canSend: isUnlimited || usedToday < normalized.dailyLimit,
    dailyLimit: normalized.dailyLimit,
    isUnlimited,
    providerLabel: normalized.apiKey ? "个人 Kimi 密钥" : "后端公共 Kimi 试用",
    remaining,
    usedToday
  };
}

export function recordAskAiUsage(store: AskAiUsageStore, settings: AskAiSettings, today = todayKey()): { status: AskAiUsageStatus; store: AskAiUsageStore } {
  const normalized = normalizeAskAiSettings(settings);
  const usageKey = usageKeyFor(normalized);
  const nextStore = { ...store };
  const entry = nextStore[usageKey]?.date === today ? nextStore[usageKey] : { count: 0, date: today };
  nextStore[usageKey] = { count: entry.count + 1, date: today };
  return {
    status: getAskAiUsageStatus(nextStore, normalized, today),
    store: nextStore
  };
}

export function usageSummaryText(status: AskAiUsageStatus): string {
  if (status.isUnlimited) {
    return `${status.providerLabel}：今日已用 ${status.usedToday} 次，不设本地上限。`;
  }
  return `${status.providerLabel}：今日已用 ${status.usedToday}/${status.dailyLimit} 次，剩余 ${status.remaining} 次。`;
}

export function getAiFeatureUsage(payload: unknown, feature: AiFeatureKey): AiFeatureUsage {
  const features = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).features
    : undefined;
  const raw = features && typeof features === "object" && !Array.isArray(features)
    ? (features as Record<string, unknown>)[feature]
    : undefined;
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const limit = nonNegativeInt(record.limit);
  const used = nonNegativeInt(record.used);
  const remaining = record.remaining === undefined ? (limit <= 0 ? 999 : Math.max(0, limit - used)) : nonNegativeInt(record.remaining);
  const isUnlimited = limit <= 0;
  return {
    canSend: isUnlimited || remaining > 0 || used < limit,
    feature,
    isUnlimited,
    limit,
    remaining,
    used
  };
}

export function aiFeatureUsageText(usage: AiFeatureUsage): string {
  if (usage.isUnlimited) {
    return `服务端 ${usage.feature}：今日已用 ${usage.used} 次，不设服务端上限。`;
  }
  return `服务端 ${usage.feature}：今日已用 ${usage.used}/${usage.limit} 次，剩余 ${usage.remaining} 次。`;
}

function usageKeyFor(settings: AskAiSettings): string {
  return `kimi|${settings.apiKey ? "personal" : "public"}|${settings.model.trim().toLowerCase()}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function isUsageStore(value: unknown): value is AskAiUsageStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
    const candidate = entry as Record<string, unknown>;
    return typeof candidate.date === "string" && typeof candidate.count === "number";
  });
}

function nonNegativeInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[,%]/g, ""));
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
  }
  return 0;
}
