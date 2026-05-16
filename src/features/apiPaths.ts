import { buildQuery } from "../core/api/data";

export function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  const next = Number.isFinite(value) ? Number(value) : fallback;
  return Math.min(max, Math.max(min, Math.trunc(next)));
}

export function yesterdayStatsPath(options: { limit?: number; tradeDate?: string } = {}): string {
  return `/api/v1/yesterday/stats${buildQuery({
    limit: clampInt(options.limit, 5, 40, 20),
    trade_date: options.tradeDate
  })}`;
}

export function boardTierPath(options: { stockLimit?: number; tierLimit?: number; tradeDate?: string } = {}): string {
  return `/api/v1/lianban/tiers${buildQuery({
    stock_limit: clampInt(options.stockLimit, 4, 40, 20),
    tier_limit: clampInt(options.tierLimit, 3, 16, 8),
    trade_date: options.tradeDate
  })}`;
}

export function limitReviewPath(options: { tradeDate?: string; weaknessLimit?: number } = {}): string {
  return `/api/v1/review-page${buildQuery({
    trade_date: options.tradeDate,
    weakness_limit: clampInt(options.weaknessLimit, 5, 40, 16)
  })}`;
}
