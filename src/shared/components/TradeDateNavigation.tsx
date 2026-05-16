import { displayDate } from "../../core/format/date";

export type TradeDateNavigationData = {
  available_trade_dates?: string[];
  next_trade_date?: string | null;
  previous_trade_date?: string | null;
  resolved_trade_date?: string | null;
};

export function TradeDateNavigation({ navigation, onChange }: { navigation?: TradeDateNavigationData; onChange: (value?: string) => void }) {
  const dates = navigation?.available_trade_dates ?? [];
  return (
    <div className="trade-date-nav">
      <button className="ghost-button" disabled={!navigation?.previous_trade_date} onClick={() => onChange(navigation?.previous_trade_date ?? undefined)} type="button">
        前一日
      </button>
      <select value={navigation?.resolved_trade_date ?? ""} onChange={(event) => onChange(event.target.value || undefined)}>
        <option value="">{displayDate(navigation?.resolved_trade_date)}</option>
        {dates.map((date) => (
          <option key={date} value={date}>
            {date}
          </option>
        ))}
      </select>
      <button className="ghost-button" disabled={!navigation?.next_trade_date} onClick={() => onChange(navigation?.next_trade_date ?? undefined)} type="button">
        后一日
      </button>
    </div>
  );
}
