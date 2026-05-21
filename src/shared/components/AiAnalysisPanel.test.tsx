import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiAnalysisPanel } from "./AiAnalysisPanel";

describe("AiAnalysisPanel", () => {
  it("turns the strategy action gray and disables generation when server quota is exhausted", () => {
    const onGenerate = vi.fn();
    render(
      <AiAnalysisPanel
        ai={{ enabled: true, provider: "Kimi" }}
        onGenerate={onGenerate}
        quota={{ canSend: false, feature: "auction", isUnlimited: false, limit: 3, remaining: 0, used: 3 }}
        title="竞价策略辅助"
      />
    );

    const button = screen.getByRole("button", { name: /今日额度已用完/ });
    expect(button).toBeDisabled();
    expect(screen.getByText("服务端竞价辅助：今日已用 3/3 次，剩余 0 次。")).toBeInTheDocument();
    expect(screen.queryByText("AI 额度已用完")).not.toBeInTheDocument();
  });

  it("cleans backend AI wording from visible empty-state reasons", () => {
    render(
      <AiAnalysisPanel
        ai={{ enabled: true, provider: "Kimi", reason: "可生成 AI 竞价分析。" }}
        onGenerate={vi.fn()}
        quota={{ canSend: true, feature: "auction", isUnlimited: false, limit: 3, remaining: 2, used: 1 }}
        title="竞价策略辅助"
      />
    );

    expect(screen.getByText("可生成策略竞价分析。")).toBeInTheDocument();
    expect(screen.queryByText("可生成 AI 竞价分析。")).not.toBeInTheDocument();
  });
});
