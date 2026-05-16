import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Save, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getRecords, getString } from "../../core/api/data";
import { queryKeys } from "../../core/api/queryKeys";
import { useApiClient } from "../../core/api/useApiClient";
import { copyText } from "../../core/desktop/desktopBridge";
import { displayDate, displayDateTime } from "../../core/format/date";
import { errorMessage } from "../../core/format/error";
import { EmptyState } from "../../shared/components/EmptyState";
import { ErrorState } from "../../shared/components/ErrorState";
import { ExportActions } from "../../shared/components/ExportActions";
import { GlassCard } from "../../shared/components/GlassCard";
import { LoadingState } from "../../shared/components/LoadingState";
import { MetricCard } from "../../shared/components/MetricCard";
import { MarkdownContent } from "../../shared/components/MarkdownContent";
import { PageHeader } from "../../shared/components/PageHeader";
import { WorkspaceSummaryBar } from "../../shared/components/WorkspaceSummaryBar";
import {
  type AskAiSettings,
  type AskAiUsageStatus,
  aiFeatureUsageText,
  buildAskAiClientConfig,
  buildAskAiSyncPayload,
  getAiFeatureUsage,
  getAskAiUsageStatus,
  loadAskAiSettings,
  loadAskAiUsageStore,
  loadOrCreateAskAiClientId,
  normalizeAskAiSettings,
  recordAskAiUsage,
  saveAskAiSettings,
  saveAskAiUsageStore,
  usageSummaryText
} from "./askAiSettings";

export function AskAiPage() {
  const client = useApiClient();
  const workspaceRef = useRef<HTMLElement | null>(null);
  const [question, setQuestion] = useState("请基于今天的涨停复盘，判断明天最值得观察的方向和风险。");
  const [answer, setAnswer] = useState("");
  const [settings, setSettings] = useState<AskAiSettings>(() => loadAskAiSettings());
  const [draftSettings, setDraftSettings] = useState<AskAiSettings>(() => loadAskAiSettings());
  const [usageStatus, setUsageStatus] = useState<AskAiUsageStatus>(() => getAskAiUsageStatus(loadAskAiUsageStore(), loadAskAiSettings()));
  const [statusText, setStatusText] = useState("");
  const clientId = useMemo(() => loadOrCreateAskAiClientId(), []);

  const context = useQuery({
    queryFn: () => client.getMap("/api/v1/ask-ai/context"),
    queryKey: queryKeys.askAiContext
  });
  const history = useQuery({
    queryFn: () => client.getMap("/api/v1/ask-ai/history?limit=7"),
    queryKey: queryKeys.askAiHistory
  });
  const serverUsage = useQuery({
    queryFn: () => client.getMap(`/api/v1/ask-ai/usage-status?client_id=${encodeURIComponent(clientId)}`),
    queryKey: ["ask-ai", "usage-status", clientId]
  });
  const usageDate = getString(context.data ?? {}, "trade_date", "") || undefined;

  useEffect(() => {
    setUsageStatus(getAskAiUsageStatus(loadAskAiUsageStore(), settings, usageDate));
  }, [settings, usageDate]);

  const sections = getRecords(context.data ?? {}, "prompt_sections");
  const generate = useMutation({
    mutationFn: async () => {
      const normalizedSettings = normalizeAskAiSettings(settings);
      const currentUsage = getAskAiUsageStatus(loadAskAiUsageStore(), normalizedSettings, usageDate);
      if (!currentUsage.canSend) {
        throw new Error(`${currentUsage.providerLabel} 已达到本地日调用上限。`);
      }
      if (normalizedSettings.apiKey) {
        await client.postMap("/api/v1/ask-ai/client-config", buildAskAiSyncPayload(normalizedSettings, clientId), 12_000);
      }
      return client.postMap("/api/v1/ask-ai/generate", {
        source: "ask_ai",
        system_prompt: context.data?.system_prompt ?? "",
        prompt_sections: context.data?.prompt_sections ?? [],
        user_prompt: question,
        client_config: buildAskAiClientConfig(normalizedSettings, clientId)
      }, 240_000);
    },
    onError: (error) => {
      setStatusText(errorMessage(error));
    },
    onSuccess: (data) => {
      const result = getString(data, "result", "");
      setAnswer(result);
      setStatusText("AI 复盘已生成。");
      const usage = recordAskAiUsage(loadAskAiUsageStore(), settings, usageDate);
      saveAskAiUsageStore(usage.store);
      setUsageStatus(usage.status);
      void serverUsage.refetch();
    }
  });
  const save = useMutation({
    mutationFn: () =>
      client.postMap("/api/v1/ask-ai/history", {
        trade_date: context.data?.trade_date,
        system_prompt: context.data?.system_prompt ?? "",
        prompt_sections: context.data?.prompt_sections ?? [],
        user_prompt: question,
        result: answer,
        source: "electron"
      }),
    onSuccess: () => history.refetch()
  });

  const cards = getRecords(context.data ?? {}, "cards");
  const sheets = useMemo(() => [{ name: "问 AI", rows: [["问题", question], ["回答", answer]] }], [answer, question]);
  const promptPreview = useMemo(() => {
    const sectionText = sections.map((section) => `## ${getString(section, "title")}\n${getString(section, "content")}`).join("\n\n");
    return [`# 系统提示`, getString(context.data ?? {}, "system_prompt", "使用当前复盘上下文回答。"), sectionText, `# 用户问题\n${question}`].filter(Boolean).join("\n\n");
  }, [context.data, question, sections]);

  if (context.isLoading) return <LoadingState title="正在加载 AI 上下文" />;
  if (context.isError) return <ErrorState message={errorMessage(context.error)} onRetry={() => context.refetch()} />;

  const templates = [
    "明天最值得观察的三条主线是什么？",
    "今天涨停结构里最大的风险在哪里？",
    "从连板高度和板块轮动看，资金偏好发生了什么变化？"
  ];
  const askAiServerUsage = getAiFeatureUsage(serverUsage.data, "ask_ai");
  const canGenerate = usageStatus.canSend && askAiServerUsage.canSend;
  const localQuotaExhausted = !usageStatus.canSend;
  const serverQuotaExhausted = usageStatus.canSend && !askAiServerUsage.canSend;
  const providerValue = settings.apiKey ? "个人 Kimi" : "公共 Kimi";

  return (
    <section className="page-scroll" ref={workspaceRef}>
      <PageHeader
        actions={<ExportActions onRefresh={() => context.refetch()} payload={{ context: context.data, answer }} sheets={sheets} targetRef={workspaceRef} title="问 AI" />}
        description="读取复盘上下文、生成 AI 策略判断、保存历史记录，并保留个人 Kimi Key 与本地限额控制。"
        meta={`${displayDate(getString(context.data ?? {}, "trade_date", ""))} · ${displayDateTime(getString(context.data ?? {}, "generated_at", ""))}`}
        title="问 AI"
      />
      <section className="metric-grid">
        {cards.slice(0, 4).map((card) => (
          <MetricCard key={getString(card, "key")} label={getString(card, "label")} value={getString(card, "value")} tone={getString(card, "tone") === "positive" ? "up" : getString(card, "tone") === "negative" ? "down" : "neutral"} />
        ))}
      </section>
      <WorkspaceSummaryBar
        detail={`${usageSummaryText(usageStatus)} · ${aiFeatureUsageText(askAiServerUsage)}`}
        items={[
          { label: "服务方", value: providerValue, tone: settings.apiKey ? "up" : "blue" },
          { label: "模型", value: settings.model || "后端默认", tone: "amber" },
          { label: "交易日", value: displayDate(getString(context.data ?? {}, "trade_date", "")), tone: "neutral" },
          { label: "本地剩余", value: usageStatus.isUnlimited ? "不限" : `${usageStatus.remaining}`, tone: usageStatus.canSend ? "up" : "down" }
        ]}
        title="AI 工作台状态"
      />
      <section className="content-grid ask-ai-layout ask-ai-console">
        <GlassCard className="ask-composer-card" eyebrow="AI 提问" title="提问工作区">
          <div className="ask-workbench">
            <div className="ask-workbench-head">
              <span>复盘问题</span>
              <b>{question.length} 字</b>
            </div>
            <div className="template-chips">
              {templates.map((template) => (
                <button key={template} onClick={() => setQuestion(template)} type="button">
                  {template}
                </button>
              ))}
            </div>
            <textarea aria-label="AI 问题" value={question} onChange={(event) => setQuestion(event.target.value)} />
            <div className={`usage-banner ${canGenerate ? "" : "danger"}`}>
              <b>{canGenerate ? "可生成" : "已限额"}</b>
              <span data-testid="ask-ai-local-usage">{usageSummaryText(usageStatus)}</span>
              <span data-testid="ask-ai-server-usage">{aiFeatureUsageText(askAiServerUsage)}</span>
            </div>
            {localQuotaExhausted ? (
              <div className="usage-banner danger">已达到本地日调用上限，当前 AI 生成按钮已锁定为灰色。</div>
            ) : null}
            {serverQuotaExhausted ? (
              <div className="usage-banner danger">服务端问 AI 今日额度已用完，当前 AI 生成按钮已锁定为灰色。</div>
            ) : null}
            {statusText ? <div className={`usage-banner ${statusText.includes("上限") || statusText.includes("失败") ? "danger" : "success"}`}>{statusText}</div> : null}
            <div className="ask-actions">
              <button className="primary-button icon-label" disabled={generate.isPending || !canGenerate} onClick={() => generate.mutate()} type="button">
                <Send size={15} />
                {generate.isPending ? "生成中" : canGenerate ? "生成回答" : "今日额度已用完"}
              </button>
              <button className="ghost-button icon-label" disabled={!answer || save.isPending} onClick={() => save.mutate()} type="button">
                <Save size={15} />
                保存历史
              </button>
              <button className="ghost-button" disabled={!answer} onClick={() => copyText(answer)} type="button">
                复制回答
              </button>
            </div>
          </div>
        </GlassCard>
        <div className="ai-side-stack ask-side-stack">
          <GlassCard className="ai-settings-card" eyebrow="额度与模型" title="AI 服务设置">
            <div className="ai-settings-panel">
              <label className="field-row">
                <span>个人 Kimi Key</span>
                <input aria-label="个人 Kimi Key" value={draftSettings.apiKey} onChange={(event) => setDraftSettings(normalizeAskAiSettings({ ...draftSettings, apiKey: event.target.value }))} placeholder="留空使用后端公共 Kimi 试用" />
              </label>
              <label className="field-row">
                <span>模型</span>
                <input aria-label="模型" value={draftSettings.model} onChange={(event) => setDraftSettings(normalizeAskAiSettings({ ...draftSettings, model: event.target.value }))} placeholder="如 kimi-k2.6，留空走后端默认" />
              </label>
              <label className="field-row">
                <span>本地日上限</span>
                <input aria-label="本地日上限" min="0" type="number" value={draftSettings.dailyLimit} onChange={(event) => setDraftSettings(normalizeAskAiSettings({ ...draftSettings, dailyLimit: Number(event.target.value) }))} />
              </label>
              <button
                className="primary-button"
                onClick={async () => {
                  const next = saveAskAiSettings(draftSettings);
                  setSettings(next);
                  setDraftSettings(next);
                  setUsageStatus(getAskAiUsageStatus(loadAskAiUsageStore(), next, usageDate));
                  if (next.apiKey) {
                    await client.postMap("/api/v1/ask-ai/client-config", buildAskAiSyncPayload(next, clientId), 12_000);
                  }
                  setStatusText("AI 设置已保存。");
                }}
                type="button"
              >
                保存 AI 设置
              </button>
            </div>
          </GlassCard>
          <GlassCard className="prompt-preview-card" eyebrow="上下文注入" title="提示词预览">
            <details>
              <summary>
                <span>
                  <b>展开完整提示词</b>
                  <small>默认收起，展开后检查系统提示、复盘上下文和用户问题。</small>
                </span>
                <button
                  className="ghost-button icon-label small"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void copyText(promptPreview);
                  }}
                type="button"
              >
                <Copy size={13} />
                复制提示词
              </button>
            </summary>
              <pre className="prompt-preview" data-testid="ask-ai-prompt-preview">{promptPreview}</pre>
            </details>
          </GlassCard>
          <GlassCard className="prompt-context-card" eyebrow="数据片段" title="复盘上下文">
            <div className="prompt-section-list">
              {sections.map((section, index) => (
                <details key={getString(section, "key")} open={index === 0}>
                  <summary>{getString(section, "title")}</summary>
                  <p>{getString(section, "content")}</p>
                </details>
              ))}
            </div>
          </GlassCard>
        </div>
      </section>
      <GlassCard className="answer-card" eyebrow="AI 输出" title="回答结果">
        <section className="answer-panel">
          {generate.isPending ? (
            <div className="ai-waiting compact">
              <b>AI 正在写复盘</b>
              <div className="typing" aria-label="AI 正在生成">
                <i />
                <i />
                <i />
              </div>
            </div>
          ) : answer ? (
            <MarkdownContent value={answer} />
          ) : (
            <EmptyState action="输入问题后生成" description="可以使用上方模板快速切入主线、风险和次日计划。" title="等待 AI 回答" tone="muted" />
          )}
        </section>
      </GlassCard>
      <GlassCard className="ask-history-card" eyebrow="复盘留痕" title="历史记录">
        <div className="history-list history-list-expanded" data-testid="ask-ai-history-list">
          {getRecords(history.data ?? {}, "items").length === 0 ? <EmptyState action="保存一次 AI 结果" description="生成并保存后，历史复盘会出现在这里。" title="暂无历史记录" tone="muted" /> : null}
          {getRecords(history.data ?? {}, "items").map((item, index) => (
            <article key={`${getString(item, "saved_at")}-${index}`}>
              <b>{displayDate(getString(item, "trade_date", ""))}</b>
              <MarkdownContent className="markdown-answer history-markdown" value={getString(item, "result", "")} />
              <footer>
                <span>{displayDateTime(getString(item, "saved_at", ""))}</span>
                <button
                  className="ghost-button icon-label small"
                  onClick={() => {
                    setQuestion(getString(item, "user_prompt", question));
                    setAnswer(getString(item, "result", ""));
                  }}
                  type="button"
                >
                  恢复
                </button>
              </footer>
            </article>
          ))}
        </div>
      </GlassCard>
    </section>
  );
}
