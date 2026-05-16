import { useMemo, useState } from "react";
import { asRecord, getString, toColumns, toRows } from "../../core/api/data";
import { SegmentedTabs } from "./SegmentedTabs";
import { TableSectionCard } from "./TableSectionCard";
import { WorkspaceSummaryBar } from "./WorkspaceSummaryBar";

export function TableWorkspaceTabs({ sections, title = "股池工作台" }: { sections: Record<string, unknown>[]; title?: string }) {
  const normalized = useMemo(
    () =>
      sections.map((section) => {
        const record = asRecord(section);
        const columns = toColumns(record);
        const rows = toRows(record, columns);
        return {
          count: getString(record, "total", String(rows.length)),
          key: getString(record, "key", getString(record, "title")),
          record,
          rows,
          title: getString(record, "title", getString(record, "key", "数据表"))
        };
      }),
    [sections]
  );
  const [activeKey, setActiveKey] = useState(normalized[0]?.key ?? "");
  const active = normalized.find((section) => section.key === activeKey) ?? normalized[0];
  const nonEmpty = normalized.filter((section) => section.rows.length > 0);
  const totalRows = normalized.reduce((sum, section) => sum + section.rows.length, 0);
  const largest = normalized.reduce<(typeof normalized)[number] | undefined>((winner, section) => {
    if (!winner || section.rows.length > winner.rows.length) {
      return section;
    }
    return winner;
  }, undefined);

  if (!active) {
    return null;
  }

  return (
    <section className="table-workspace">
      <WorkspaceSummaryBar
        detail={active.title}
        items={[
          { label: "股池", value: normalized.length, tone: "blue" },
          { label: "非空", value: nonEmpty.length, tone: nonEmpty.length > 0 ? "up" : "neutral" },
          { label: "总样本", value: totalRows, tone: totalRows > 0 ? "up" : "neutral" },
          { label: "主股池", value: largest?.title ?? "--", detail: largest ? `${largest.rows.length} 条` : undefined, tone: "amber" }
        ]}
        title={title}
      />
      <div className="table-workspace-tabs">
        <SegmentedTabs
          activeKey={active.key}
          items={normalized.map((section) => ({
            count: section.count,
            key: section.key,
            label: section.title,
            tone: section.rows.length > 0 ? "up" : "neutral"
          }))}
          onChange={setActiveKey}
        />
      </div>
      <div className="table-workspace-panel" key={active.key}>
        <TableSectionCard section={active.record} />
      </div>
    </section>
  );
}
