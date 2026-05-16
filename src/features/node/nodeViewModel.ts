import { getNumber, getRecords, getString } from "../../core/api/data";

export type NodePlateTag = {
  code: string;
  count: number;
  intensity: number;
  name: string;
  rankTotal: number;
  tone: "cool" | "hot" | "warm";
};

export type NodeDateItem = Record<string, unknown> & {
  date: string;
  topPlates: Array<Record<string, unknown>>;
};

export function normalizeNodeDateItems(data: Record<string, unknown>): NodeDateItem[] {
  return getRecords(data, "date_items").map((item) => ({
    ...item,
    date: getString(item, "date", ""),
    topPlates: getRecords(item, "top_plates")
  })).filter((item) => item.date.length > 0);
}

export function buildRepeatedPlateTags(dateItems: NodeDateItem[], limit = 12): NodePlateTag[] {
  const stats = new Map<string, { code: string; count: number; name: string; rankTotal: number }>();
  dateItems.slice(-21).forEach((item) => {
    item.topPlates.forEach((plate, index) => {
      const code = getString(plate, "plate_code", getString(plate, "code", ""));
      const name = getString(plate, "plate_name", getString(plate, "name", ""));
      if ((!code || code === "--") && (!name || name === "--")) return;
      const key = code && code !== "--" ? code : name;
      const previous = stats.get(key) ?? { code, count: 0, name, rankTotal: 0 };
      const rank = getNumber(plate, "rank") ?? index + 1;
      stats.set(key, {
        code: previous.code || code,
        count: previous.count + 1,
        name: previous.name || name,
        rankTotal: previous.rankTotal + Math.max(1, rank)
      });
    });
  });

  const maxCount = Math.max(...Array.from(stats.values()).map((item) => item.count), 1);
  return Array.from(stats.values())
    .map((item) => {
      const averageRank = item.rankTotal / item.count;
      const intensity = item.count * 100 - averageRank * 7;
      return {
        ...item,
        intensity,
        tone: item.count >= Math.max(3, maxCount * 0.66) ? "hot" : item.count >= 2 ? "warm" : "cool"
      } satisfies NodePlateTag;
    })
    .sort((left, right) => right.count - left.count || left.rankTotal - right.rankTotal || left.name.localeCompare(right.name, "zh-Hans-CN"))
    .slice(0, limit);
}

export function resolveSelectedNodeDate(dateItems: NodeDateItem[], requested?: string, fallback?: string): string {
  if (requested && dateItems.some((item) => item.date === requested)) return requested;
  if (fallback && dateItems.some((item) => item.date === fallback)) return fallback;
  return dateItems[dateItems.length - 1]?.date ?? "";
}

export function resolveSelectedNodePlate(item: NodeDateItem | undefined, requested?: string): { code: string; name: string } | null {
  const plates = item?.topPlates ?? [];
  const selected = plates.find((plate) => getString(plate, "plate_code", "") === requested) ?? plates[0];
  if (!selected) return null;
  return {
    code: getString(selected, "plate_code", ""),
    name: getString(selected, "plate_name", "--")
  };
}
