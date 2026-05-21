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
  title = "模型复盘摘要"
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
  const emptyReason = cleanAiDisplayText(ai?.reason || "暂无策略结论");
  return (
    <GlassCard
      actions={
        onGenerate ? (
          <button className="primary-button icon-label" disabled={loading || !canGenerate} onClick={onGenerate} type="button">
            <Sparkles size={15} />
            {loading ? "生成中" : quotaEnabled ? "生成策略" : "今日额度已用完"}
          </button>
        ) : null
      }
      className={`ai-card ${quotaEnabled ? "" : "ai-card-disabled"}`}
      eyebrow={`${ai?.provider ?? "模型"} ${ai?.model ?? ""}`.trim()}
      title={title}
    >
      {quota ? (
        <div className={`ai-quota-banner ${quota.canSend ? "" : "disabled"}`}>
          <b>{quota.canSend ? "策略额度可用" : "策略额度已用完"}</b>
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
            模型正在整理复盘
          </b>
          <div className="typing" aria-label="策略内容正在生成">
            <i />
            <i />
            <i />
          </div>
          <p>会按市场温度、主线强度、风险位置和次日观察点四段生成。</p>
        </div>
      ) : (
        <EmptyState action={onGenerate ? "点击生成策略" : undefined} description="暂时没有生成结论，可以先完成数据抓取或重新请求策略复盘。" hint={ai?.provider ? `当前提供方：${ai.provider}` : undefined} title={emptyReason} tone="muted" />
      )}
    </GlassCard>
  );
}

function cleanAiDisplayText(value: string): string {
  return value.replace(/\s*\bAI\b\s*/g, "策略");
}
