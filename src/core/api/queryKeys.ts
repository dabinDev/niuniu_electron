export const queryKeys = {
  askAiContext: ["ask-ai", "context"] as const,
  askAiHistory: ["ask-ai", "history"] as const,
  auction: (days: number, stockLimit: number, rankLimit: number) => ["auction", days, stockLimit, rankLimit] as const,
  boardHeight: (tradeDate?: string) => ["board-height", tradeDate ?? "latest"] as const,
  boardTier: (tradeDate?: string) => ["board-tier", tradeDate ?? "latest"] as const,
  jobs: (forceRefresh = false) => ["jobs", forceRefresh] as const,
  limitReview: (tradeDate?: string) => ["limit-review", tradeDate ?? "latest"] as const,
  marketCenter: (tradeDate?: string) => ["market-center", tradeDate ?? "latest"] as const,
  news: (tab: string) => ["news", tab] as const,
  node: (symbol: string, days: number) => ["node", symbol, days] as const,
  overview: ["overview"] as const,
  plateRotation: (tradeDate?: string) => ["plate-rotation", tradeDate ?? "latest"] as const,
  yesterdayStats: (tradeDate?: string, section?: string) => ["yesterday-stats", tradeDate ?? "latest", section ?? "all"] as const
};
