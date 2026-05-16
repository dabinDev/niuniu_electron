import { asRecord, getString, toColumns, toRows } from "../../core/api/data";
import { DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { GlassCard } from "./GlassCard";

export function TableSectionCard({ section }: { section: Record<string, unknown> }) {
  const record = asRecord(section);
  const columns = toColumns(record);
  const rows = toRows(record, columns);
  const total = getString(record, "total", String(rows.length));
  const updatedAt = getString(record, "updated_at", getString(record, "fetched_at", ""));
  const sortHint = getString(record, "sort", getString(record, "sort_key", ""));
  return (
    <GlassCard eyebrow={`${total} 条`} title={getString(record, "title", getString(record, "key", "数据表"))}>
      <div className="section-meta-strip">
        <span>字段 {columns.length}</span>
        <span>样本 {total}</span>
        {sortHint && sortHint !== "--" ? <span>排序 {sortHint}</span> : null}
        {updatedAt && updatedAt !== "--" ? <span>更新 {updatedAt}</span> : null}
      </div>
      {rows.length === 0 ? (
        <EmptyState action="切换交易日或刷新接口" description="当前表格没有返回记录，保留表头便于确认字段结构。" hint={`表格字段：${columns.map((column) => column.label).join(" / ") || "暂无"}`} tone="market" />
      ) : (
        <DataTable columns={columns} rows={rows} />
      )}
    </GlassCard>
  );
}
