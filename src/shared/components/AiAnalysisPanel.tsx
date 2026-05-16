import { Bot, Sparkles } from "lucide-react";
import { displayDateTime } from "../../core/format/date";
import type { AiFeatureUsage } from "../../features/askAi/askAiSettings";
import { aiFeatureUsageText } from "../../features/askAi/askAiSettings";
import { EmptyState } from "./EmptyState";
import { GlassCard } from "./GlassCard";
import { MarkdownContent } from "./MarkdownContent";

export type AiState = {
  analysis?: string;
  cached?: boolean;
  enabled?: boolean;
  generated_at?: string | null;
  model?: string;
  provider?: string;
  reason?: string;
  source?: string;
};

export function AiAnalysisPanel({
  ai,
  loading = false,
  onGenerate,
  quota,
  title = "AI 复盘摘要"
}: {
  ai?: AiState | null;
  loading?: boolean;
  onGenerate?: () => void;
  quota?: AiFeatureUsage;
  title?: string;
}) {
  const enabled = ai?.enabled ?? Boolean(onGenerate);
  const quotaEnabled = quota?.canSend ?? true;
  const canGenerate = enabled && quotaEnabled;
  return (
    <GlassCard
      actions={
        onGenerate ? (
          <button className="primary-button icon-label" disabled={loading || !canGenerate} onClick={onGenerate} type="button">
            <Sparkles size={15} />
            {loading ? "生成中" : quotaEnabled ? "生成 AI" : "今日额度已用完"}
          </button>
        ) : null
      }
      className={`ai-card ${quotaEnabled ? "" : "ai-card-disabled"}`}
      eyebrow={`${ai?.provider ?? "AI"} ${ai?.model ?? ""}`.trim()}
      title={title}
    >
      {quota ? (
        <div className={`ai-quota-banner ${quota.canSend ? "" : "disabled"}`}>
          <b>{quota.canSend ? "AI 额度可用" : "AI 额度已用完"}</b>
          <span>{aiFeatureUsageText(quota)}</span>
        </div>
      ) : null}
      {ai?.analysis ? (
        <div className="analysis-body">
          <section className="summary-card">
            <b>
              <Bot size={15} />
              {ai.cached ? "缓存结论" : "最新结论"}
            </b>
            <MarkdownContent className="markdown-answer ai-markdown" value={ai.analysis} />
          </section>
          <div className="ai-meta">
            <span>来源：{ai.source ?? "workspace"}</span>
            <span>生成：{displayDateTime(ai.generated_at)}</span>
          </div>
        </div>
      ) : loading ? (
        <div className="ai-waiting">
          <b>
            <Bot size={15} />
            AI 正在整理复盘
          </b>
          <div className="typing" aria-label="AI 正在生成">
            <i />
            <i />
            <i />
          </div>
          <p>会按市场温度、主线强度、风险位置和次日观察点四段生成。</p>
        </div>
      ) : (
        <EmptyState action={onGenerate ? "点击生成 AI" : undefined} description="暂时没有生成结论，可以先完成数据抓取或重新请求 AI 复盘。" hint={ai?.provider ? `当前提供方：${ai.provider}` : undefined} title={ai?.reason || "暂无 AI 结论"} tone="muted" />
      )}
    </GlassCard>
  );
}
