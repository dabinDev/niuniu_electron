import { getNumber, getOptionalString, getRecords, getString } from "../../core/api/data";
import type { TrendSeries } from "../../shared/components/TrendLineChart";

export type PlateRotationCell = {
  code?: string;
  colorIndex: number;
  date: string;
  name: string;
  rank: number;
  resolvedCode?: string;
  strength: string;
  strengthValue: string;
  ztCount: string;
};

export type PlateRotationSelection = {
  code: string;
  date: string;
  name: string;
  rank: number;
  strength: string;
  strengthValue: string;
};

export type PlateRotationSequenceItem = {
  code?: string;
  colorIndex: number;
  latestStrength: string;
  latestStrengthValue: string;
  name: string;
  series: Array<{
    date: string;
    strength: number | null;
    strengthText: string;
  }>;
  ztCount: string;
};

export type PlateRotationViewModel = {
  dates: string[];
  nearTerm: PlateRotationCell[];
  rankRows: Array<{
    cells: Array<PlateRotationCell | null>;
    rank: number;
  }>;
  sequence: PlateRotationSequenceItem[];
  total: number;
};

const invalidCodes = new Set(["", "--", "null", "undefined"]);

export function buildPlateRotationViewModel(snapshot: Record<string, unknown>): PlateRotationViewModel {
  const sequenceRecords = getRecords(snapshot, "items");
  const codeByName = new Map<string, string>();
  sequenceRecords.forEach((item) => {
    const name = getString(item, "plate_name", getString(item, "name", "--"));
    const code = cleanCode(getOptionalString(item, "plate_code") ?? getOptionalString(item, "code"));
    if (code) {
      codeByName.set(name, code);
    }
  });
  const matrixColumns = getRecords(snapshot, "matrix_columns");
  const colorByPlate = buildPlateColorMap(matrixColumns, codeByName);
  const sequence = sequenceRecords.map((item) => {
    const name = getString(item, "plate_name", getString(item, "name", "--"));
    const code = cleanCode(getOptionalString(item, "plate_code") ?? getOptionalString(item, "code"));
    const colorIndex = colorForPlate(colorByPlate, code, name);
    const latestStrength = formatRotationStrength(item.latest_zt ?? item.zt_count);
    return {
      code,
      colorIndex,
      latestStrength,
      latestStrengthValue: latestStrength,
      name,
      series: getRecords(item, "series").map((point) => {
        const pointStrength = formatRotationStrength(point.latest_zt ?? point.zt_count);
        return {
          date: getString(point, "date", ""),
          strength: rotationStrengthToNumber(pointStrength),
          strengthText: pointStrength
        };
      }),
      ztCount: latestStrength
    };
  });

  const dates = matrixColumns.map((column) => getString(column, "date", "--"));
  const ranks = Array.from(new Set(matrixColumns.flatMap((column) => getRecords(column, "items").map((item) => getNumber(item, "rank") ?? 0))))
    .filter((rank) => rank > 0)
    .sort((left, right) => left - right);

  const cellsByDateRank = new Map<string, PlateRotationCell>();
  matrixColumns.forEach((column) => {
    const date = getString(column, "date", "--");
    getRecords(column, "items").forEach((item) => {
      const name = getString(item, "plate_name", getString(item, "name", "--"));
      const rank = getNumber(item, "rank") ?? 0;
      const code = cleanCode(getOptionalString(item, "plate_code") ?? getOptionalString(item, "code"));
      const resolvedCode = code ?? codeByName.get(name);
      const cell: PlateRotationCell = {
        code,
        colorIndex: colorForPlate(colorByPlate, resolvedCode, name),
        date,
        name,
        rank,
        resolvedCode,
        strength: formatRotationStrength(item.latest_zt ?? item.zt_count),
        strengthValue: formatRotationStrength(item.latest_zt ?? item.zt_count),
        ztCount: formatRotationStrength(item.latest_zt ?? item.zt_count)
      };
      cellsByDateRank.set(`${date}-${rank}`, cell);
    });
  });

  const rankRows = ranks.map((rank) => ({
    rank,
    cells: dates.map((date) => cellsByDateRank.get(`${date}-${rank}`) ?? null)
  }));

  const nearTerm = dates.slice(0, 2).flatMap((date) =>
    rankRows
      .slice(0, 6)
      .map((row) => row.cells[dates.indexOf(date)])
      .filter((cell): cell is PlateRotationCell => Boolean(cell))
  );

  return {
    dates,
    nearTerm,
    rankRows,
    sequence,
    total: getNumber(snapshot, "total") ?? sequence.length
  };
}

export function resolvePlateSelection(cell: PlateRotationCell | null | undefined): PlateRotationSelection | null {
  const code = cleanCode(cell?.resolvedCode ?? cell?.code);
  if (!cell || !code) {
    return null;
  }
  return {
    code,
    date: cell.date,
    name: cell.name,
    rank: cell.rank,
    strength: cell.strength,
    strengthValue: cell.strengthValue
  };
}

export function sequenceItemToSelection(item: PlateRotationSequenceItem | null | undefined, fallbackDate: string): PlateRotationSelection | null {
  const code = cleanCode(item?.code);
  if (!item || !code) {
    return null;
  }
  return {
    code,
    date: fallbackDate,
    name: item.name,
    rank: 0,
    strength: item.latestStrength,
    strengthValue: item.latestStrengthValue
  };
}

export function sequenceToTrendSeries(sequence: PlateRotationSequenceItem[], limit = 5): TrendSeries[] {
  const tones: TrendSeries["tone"][] = ["up", "amber", "info", "down", "neutral"];
  return sequence
    .filter((item) => item.series.some((point) => point.strength !== null))
    .slice(0, limit)
    .map((item, index) => ({
      name: item.name,
      points: item.series.map((point) => ({
        hint: point.strengthText,
        label: point.date.slice(5),
        value: point.strength
      })),
      tone: tones[index % tones.length]
    }));
}

function cleanCode(value: string | undefined): string | undefined {
  const normalized = String(value ?? "").trim();
  return invalidCodes.has(normalized) ? undefined : normalized;
}

function buildPlateColorMap(matrixColumns: Record<string, unknown>[], codeByName: Map<string, string>): Map<string, number> {
  const stats = new Map<string, { count: number; firstSeen: number; name: string; rankTotal: number; strengthTotal: number }>();
  let order = 0;
  matrixColumns.slice(0, 20).forEach((column) => {
    getRecords(column, "items").forEach((item) => {
      const rank = getNumber(item, "rank") ?? 999;
      if (rank > 3) return;
      const name = getString(item, "plate_name", getString(item, "name", "--"));
      const code = cleanCode(getOptionalString(item, "plate_code") ?? getOptionalString(item, "code")) ?? codeByName.get(name);
      const key = plateKey(code, name);
      if (!key) return;
      const previous = stats.get(key) ?? { count: 0, firstSeen: order++, name, rankTotal: 0, strengthTotal: 0 };
      stats.set(key, {
        ...previous,
        count: previous.count + 1,
        rankTotal: previous.rankTotal + rank,
        strengthTotal: previous.strengthTotal + (getNumber(item, "latest_zt") ?? getNumber(item, "zt_count") ?? getNumber(item, "strength") ?? getNumber(item, "latest_strength") ?? parseStrengthText(getString(item, "strength_text", "")) ?? 0)
      });
    });
  });

  return new Map(
    Array.from(stats.entries())
      .sort((left, right) => {
        const leftValue = left[1];
        const rightValue = right[1];
        return rightValue.count - leftValue.count
          || rightValue.strengthTotal / rightValue.count - leftValue.strengthTotal / leftValue.count
          || leftValue.rankTotal / leftValue.count - rightValue.rankTotal / rightValue.count
          || leftValue.firstSeen - rightValue.firstSeen
          || leftValue.name.localeCompare(rightValue.name, "zh-Hans-CN");
      })
      .map(([key], index) => [key, index % 8])
  );
}

function colorForPlate(colorByPlate: Map<string, number>, code: string | undefined, name: string): number {
  const key = plateKey(code, name);
  if (!key) return 7;
  const existing = colorByPlate.get(key);
  if (existing !== undefined) return existing;
  const fallbackKey = plateKey(undefined, name);
  const fallback = fallbackKey ? colorByPlate.get(fallbackKey) : undefined;
  if (fallback !== undefined) return fallback;
  const next = colorByPlate.size % 8;
  colorByPlate.set(key, next);
  return next;
}

function plateKey(code: string | undefined, name: string): string {
  const cleanName = name && name !== "--" ? name.trim() : "";
  return code ? `code:${code}` : cleanName ? `name:${cleanName}` : "";
}

function formatRotationStrength(value: unknown): string {
  if (typeof value === "number") {
    return Number.isInteger(value) && Number.isFinite(value) ? String(value) : "--";
  }
  if (typeof value !== "string") {
    return "--";
  }
  const normalized = value.trim().replace(/,/g, "");
  if (!normalized || normalized.includes("%") || normalized.includes(".")) {
    return "--";
  }
  return /^-?\d+$/.test(normalized) ? String(Number(normalized)) : "--";
}

function rotationStrengthToNumber(value: string): number | null {
  if (value === "--") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatStrengthValue(value: number | undefined, fallbackText: string): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2).replace(/\.?0+$/, "");
  }
  const parsed = parseStrengthText(fallbackText);
  if (Number.isFinite(parsed)) {
    return parsed!.toFixed(2).replace(/\.?0+$/, "");
  }
  return fallbackText || "--";
}

function parseStrengthText(value: string): number | undefined {
  const parsed = Number(value.replace(/[+,%]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}
