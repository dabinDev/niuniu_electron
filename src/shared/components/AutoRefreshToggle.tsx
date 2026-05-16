import clsx from "clsx";
import { RefreshCw } from "lucide-react";

export function AutoRefreshToggle({
  enabled,
  intervalLabel,
  onChange
}: {
  enabled: boolean;
  intervalLabel: string;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      aria-label={`自动刷新 ${enabled ? intervalLabel : "已暂停"}`}
      className={clsx("auto-refresh-toggle", enabled ? "is-live" : "is-paused")}
      onClick={() => onChange(!enabled)}
      type="button"
    >
      <RefreshCw size={14} />
      <span>自动</span>
      <b>{enabled ? intervalLabel : "暂停"}</b>
    </button>
  );
}
