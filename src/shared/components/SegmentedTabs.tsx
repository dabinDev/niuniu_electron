import { type CSSProperties, useEffect, useRef, useState } from "react";

export type TabItem = {
  count?: number | string;
  key: string;
  label: string;
  tone?: "down" | "neutral" | "up";
};

export function SegmentedTabs({ activeKey, items, onChange }: { activeKey: string; items: TabItem[]; onChange: (key: string) => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const [indicator, setIndicator] = useState<{ width: number; x: number } | null>(null);

  useEffect(() => {
    function measure() {
      const root = rootRef.current;
      const active = activeRef.current;
      if (!root || !active) {
        return;
      }
      setIndicator({
        width: active.offsetWidth,
        x: active.offsetLeft - root.scrollLeft
      });
    }

    measure();
    const frame = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [activeKey, items.length]);

  return (
    <div
      aria-label="分段视图"
      className="segmented segmented-animated"
      ref={rootRef}
      role="tablist"
      style={indicator ? ({
        "--tab-indicator-width": `${indicator.width}px`,
        "--tab-indicator-x": `${indicator.x}px`
      } as CSSProperties) : undefined}
    >
      {items.map((item) => {
        const active = activeKey === item.key;
        return (
          <button aria-selected={active} className={active ? "on" : ""} key={item.key} onClick={() => onChange(item.key)} ref={active ? activeRef : undefined} type="button">
            <span className="segmented-label">{item.label}</span>
            {item.count !== undefined && item.count !== "" ? <span className={`segmented-count ${item.tone ?? "neutral"}`}>{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
