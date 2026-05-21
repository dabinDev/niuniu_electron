import { describe, expect, it } from "vitest";
import {
  buildAskAiClientConfig,
  buildAskAiSyncPayload,
  aiFeatureUsageText,
  getAiFeatureUsage,
  getAskAiUsageStatus,
  normalizeAskAiSettings,
  recordAskAiUsage
} from "./askAiSettings";

describe("askAiSettings", () => {
  it("syncs personal Kimi key to the server while keeping generation payload secret-free", () => {
    const settings = normalizeAskAiSettings({
      apiKey: " personal-test-key ",
      dailyLimit: 0,
      model: " kimi-k2.6 "
    });

    expect(buildAskAiSyncPayload(settings, "electron-test")).toEqual({
      api_key: "personal-test-key",
      client_id: "electron-test",
      model: "kimi-k2.6",
      provider: "kimi"
    });
    expect(buildAskAiClientConfig(settings, "electron-test")).toEqual({
      client_id: "electron-test",
      provider: "kimi"
    });
  });

  it("omits stale model and api key when the user relies on backend defaults", () => {
    const settings = normalizeAskAiSettings({
      apiKey: "",
      dailyLimit: -5,
      model: "gpt-4o-mini"
    });

    expect(settings.dailyLimit).toBe(0);
    expect(settings.model).toBe("");
    expect(buildAskAiSyncPayload(settings, "electron-test")).toEqual({
      api_key: "",
      client_id: "electron-test",
      provider: "kimi"
    });
  });

  it("tracks local daily usage by public or personal key scope", () => {
    const publicSettings = normalizeAskAiSettings({ apiKey: "", dailyLimit: 1, model: "" });
    const personalSettings = normalizeAskAiSettings({ apiKey: "abc", dailyLimit: 2, model: "kimi-k2.6" });
    const today = "2026-05-14";
    const first = recordAskAiUsage({}, publicSettings, today);
    const second = recordAskAiUsage(first.store, publicSettings, today);

    expect(first.status.canSend).toBe(false);
    expect(second.status.usedToday).toBe(2);
    expect(second.status.canSend).toBe(false);
    expect(getAskAiUsageStatus(second.store, personalSettings, today).usedToday).toBe(0);
    expect(getAskAiUsageStatus(second.store, personalSettings, today).canSend).toBe(true);
  });

  it("normalizes server per-feature AI quota status", () => {
    const usage = getAiFeatureUsage({
      client_id: "electron-test",
      features: {
        ask_ai: { limit: 2, remaining: 0, used: 2 },
        auction: { limit: 3, remaining: 1, used: 2 },
        limit_review: { limit: 0, remaining: 999, used: 8 }
      },
      has_own_key: false
    }, "ask_ai");

    expect(usage).toEqual({
      canSend: false,
      feature: "ask_ai",
      isUnlimited: false,
      limit: 2,
      remaining: 0,
      used: 2
    });
    expect(getAiFeatureUsage({ features: { limit_review: { limit: 0, remaining: 999, used: 8 } } }, "limit_review").canSend).toBe(true);
    expect(aiFeatureUsageText(usage)).toBe("服务端策略问答：今日已用 2/2 次，剩余 0 次。");
    expect(aiFeatureUsageText(getAiFeatureUsage({ features: { auction: { limit: 3, remaining: 1, used: 2 } } }, "auction"))).toBe("服务端竞价辅助：今日已用 2/3 次，剩余 1 次。");
  });
});
