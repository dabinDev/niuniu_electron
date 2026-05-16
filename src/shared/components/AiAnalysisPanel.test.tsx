import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiAnalysisPanel } from "./AiAnalysisPanel";

describe("AiAnalysisPanel", () => {
  it("turns the AI action gray and disables generation when server quota is exhausted", () => {
    const onGenerate = vi.fn();
    render(
      <AiAnalysisPanel
        ai={{ enabled: true, provider: "Kimi" }}
        onGenerate={onGenerate}
        quota={{ canSend: false, feature: "auction", isUnlimited: false, limit: 3, remaining: 0, used: 3 }}
        title="竞价 AI 分析"
      />
    );

    const button = screen.getByRole("button", { name: /今日额度已用完/ });
    expect(button).toBeDisabled();
    expect(screen.getByText("服务端 auction：今日已用 3/3 次，剩余 0 次。")).toBeInTheDocument();
  });
});
