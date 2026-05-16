import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Link2, X } from "lucide-react";
import { getOptionalString, getString } from "../../core/api/data";
import { useApiClient } from "../../core/api/useApiClient";
import { openStock } from "../../core/desktop/desktopBridge";
import { displayDate } from "../../core/format/date";
import { formatNumber, formatPercent } from "../../core/format/number";
import { usePreferencesStore } from "../../app/preferencesStore";
import { ErrorState } from "./ErrorState";
import { KlineChart } from "./KlineChart";
import { LoadingState } from "./LoadingState";

export function StockProfileSheet({ onClose, symbol }: { onClose: () => void; symbol: string }) {
  const client = useApiClient();
  const stockLinkClient = usePreferencesStore((state) => state.stockLinkClient);
  const tdxPath = usePreferencesStore((state) => state.tdxPath);
  const thsPath = usePreferencesStore((state) => state.thsPath);
  const profile = useQuery({
    queryFn: () => client.getMap(`/api/v1/stocks/${encodeURIComponent(symbol)}/profile`),
    queryKey: ["stock-profile", symbol]
  });
  const quote = useQuery({
    queryFn: () => client.getMap(`/api/v1/stocks/${encodeURIComponent(symbol)}/quote`),
    queryKey: ["stock-quote", symbol]
  });
  const kline = useQuery({
    queryFn: () => client.getMap(`/api/v1/stocks/${encodeURIComponent(symbol)}/kline?days=90`),
    queryKey: ["stock-kline", symbol]
  });

  return (
    <div className="sheet-backdrop">
      <aside className="stock-sheet">
        <header>
          <div>
            <span className="card-eyebrow">股票详情</span>
            <h2>{getString(profile.data ?? {}, "name", symbol)}</h2>
            <p>
              {symbol} · {getOptionalString(profile.data ?? {}, "industry_name") ?? "行业未标注"}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            <X size={17} />
          </button>
        </header>

        {profile.isLoading || quote.isLoading || kline.isLoading ? <LoadingState title="正在加载股票详情" /> : null}
        {profile.isError ? <ErrorState message={profile.error.message} onRetry={() => profile.refetch()} /> : null}

        {profile.data ? (
          <>
            <div className="sheet-metrics">
              <article>
                <small>最新价</small>
                <strong>{formatNumber(quote.data?.price)}</strong>
              </article>
              <article>
                <small>涨跌幅</small>
                <strong>{formatPercent(quote.data?.change_pct)}</strong>
              </article>
              <article>
                <small>换手率</small>
                <strong>{formatPercent(quote.data?.turnover_rate)}</strong>
              </article>
              <article>
                <small>上市日期</small>
                <strong>{displayDate(getOptionalString(profile.data, "listing_date"))}</strong>
              </article>
            </div>
            <KlineChart bars={(kline.data?.bars as Array<Record<string, unknown>> | undefined) ?? []} />
            <div className="sheet-actions">
              <button
                className="primary-button icon-label"
                onClick={() => openStock({ client: stockLinkClient, symbol, tdxPath, thsPath })}
                type="button"
              >
                <Link2 size={15} />
                联动股票客户端
              </button>
              <button className="ghost-button icon-label" onClick={() => window.open(`https://quote.eastmoney.com/${symbol}.html`, "_blank")} type="button">
                <ExternalLink size={15} />
                东方财富
              </button>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  );
}
