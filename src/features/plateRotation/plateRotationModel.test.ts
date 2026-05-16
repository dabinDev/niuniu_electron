import { describe, expect, it } from "vitest";
import { buildPlateRotationViewModel, resolvePlateSelection, sequenceToTrendSeries } from "./plateRotationModel";

const snapshot = {
  items: [
    { plate_code: "BK001", plate_name: "算力", latest_strength_text: "+15.74%", latest_zt: 8 },
    { plate_code: "BK002", plate_name: "芯片", latest_strength_text: "+15.69%", latest_zt: 7 }
  ],
  matrix_columns: [
    {
      date: "2026-05-13",
      items: [
        { rank: 1, plate_code: "", plate_name: "算力", strength_text: "+15.74%", zt_count: 8 },
        { rank: 2, plate_code: "BK002", plate_name: "芯片", strength_text: "+15.69%", zt_count: 7 }
      ]
    },
    {
      date: "2026-05-12",
      items: [
        { rank: 1, plate_code: "BK002", plate_name: "芯片", strength_text: "+11.03%", zt_count: 6 },
        { rank: 2, plate_code: "BK001", plate_name: "算力", strength_text: "+5.07%", zt_count: 4 }
      ]
    }
  ]
};

describe("plateRotationModel", () => {
  it("normalizes the matrix into rank rows with stable plate colors", () => {
    const model = buildPlateRotationViewModel(snapshot);

    expect(model.dates).toEqual(["2026-05-13", "2026-05-12"]);
    expect(model.rankRows).toHaveLength(2);
    expect(model.rankRows[0].cells.map((cell) => cell?.name)).toEqual(["算力", "芯片"]);
    expect(model.rankRows[1].cells.map((cell) => cell?.name)).toEqual(["芯片", "算力"]);
    expect(model.rankRows[0].cells[0]?.colorIndex).toBe(model.rankRows[1].cells[1]?.colorIndex);
  });

  it("resolves missing matrix plate codes from the plate sequence before requesting stocks", () => {
    const model = buildPlateRotationViewModel(snapshot);
    const selection = resolvePlateSelection(model.rankRows[0].cells[0]);

    expect(selection).toEqual({
      code: "BK001",
      date: "2026-05-13",
      name: "算力",
      rank: 1,
      strength: "8",
      strengthValue: "8"
    });
  });

  it("does not produce a requestable selection when no plate code can be resolved", () => {
    const model = buildPlateRotationViewModel({
      matrix_columns: [{ date: "2026-05-13", items: [{ rank: 1, plate_name: "未知板块" }] }]
    });

    expect(resolvePlateSelection(model.rankRows[0].cells[0])).toBeNull();
  });

  it("uses latest_zt and zt_count raw values as displayed plate strength", () => {
    const model = buildPlateRotationViewModel({
      items: [{ plate_code: "BK001", plate_name: "算力", latest_strength: 15.74, latest_zt: 15740 }],
      matrix_columns: [
        { date: "2026-05-13", items: [{ rank: 1, plate_code: "BK001", plate_name: "算力", strength: 15.74, zt_count: 15740 }] }
      ]
    });

    expect(model.sequence[0].latestStrengthValue).toBe("15740");
    expect(model.sequence[0].latestStrength).toBe("15740");
    expect(model.sequence[0].ztCount).toBe("15740");
    expect(model.rankRows[0].cells[0]?.strengthValue).toBe("15740");
    expect(model.rankRows[0].cells[0]?.ztCount).toBe("15740");
  });

  it("does not round decimal strength percentages into limit-up counts", () => {
    const model = buildPlateRotationViewModel({
      items: [{ plate_code: "BK001", plate_name: "算力", latest_strength_text: "+15.74%", latest_zt: "15.74%" }],
      matrix_columns: [
        { date: "2026-05-13", items: [{ rank: 1, plate_code: "BK001", plate_name: "算力", strength_text: "+15.74%", zt_count: "15.74%" }] }
      ]
    });

    expect(model.sequence[0].latestStrengthValue).toBe("--");
    expect(model.sequence[0].ztCount).toBe("--");
    expect(model.rankRows[0].cells[0]?.ztCount).toBe("--");
  });

  it("prefers latest_zt over zt_count and percentage strength fields", () => {
    const model = buildPlateRotationViewModel({
      items: [{ plate_code: "BK001", plate_name: "算力", latest_strength: 12619, latest_strength_text: "+126.19%", latest_zt: 15740 }],
      matrix_columns: [
        { date: "2026-05-13", items: [{ rank: 1, plate_code: "BK001", plate_name: "算力", latest_zt: 15740, strength: 12619, strength_text: "+126.19%", zt_count: 12619 }] }
      ]
    });

    expect(model.sequence[0].latestStrengthValue).toBe("15740");
    expect(model.sequence[0].latestStrength).toBe("15740");
    expect(model.rankRows[0].cells[0]?.strengthValue).toBe("15740");
    expect(model.rankRows[0].cells[0]?.strength).toBe("15740");
  });

  it("uses latest_zt for the trend series and zt_count for dated matrix cells", () => {
    const model = buildPlateRotationViewModel({
      items: [{
        plate_code: "BK001",
        plate_name: "算力",
        latest_strength: 15.74,
        latest_strength_text: "+15.74%",
        latest_zt: 15740,
        series: [
          { date: "2026-05-12", latest_zt: 12619, strength: 12.619, strength_text: "+12.62%", zt_count: 12 },
          { date: "2026-05-13", latest_zt: 15740, strength: 15.74, strength_text: "+15.74%", zt_count: 15 }
        ]
      }]
    });

    const trend = sequenceToTrendSeries(model.sequence, 1);

    expect(trend[0].points.map((point) => point.value)).toEqual([12619, 15740]);
    expect(trend[0].points.map((point) => point.hint)).toEqual(["12619", "15740"]);
  });

  it("assigns the most vivid colors to plates that repeat most often in the 20-day top three", () => {
    const model = buildPlateRotationViewModel({
      items: [
        { plate_code: "BK004", plate_name: "低空", latest_strength: 9100 },
        { plate_code: "BK001", plate_name: "算力", latest_strength: 12619 },
        { plate_code: "BK002", plate_name: "芯片", latest_strength: 11800 },
        { plate_code: "BK003", plate_name: "机器人", latest_strength: 9900 }
      ],
      matrix_columns: [
        {
          date: "2026-05-14",
          items: [
            { rank: 1, plate_code: "BK001", plate_name: "算力", strength: 12619 },
            { rank: 2, plate_code: "BK002", plate_name: "芯片", strength: 11800 },
            { rank: 3, plate_code: "BK003", plate_name: "机器人", strength: 9900 }
          ]
        },
        {
          date: "2026-05-13",
          items: [
            { rank: 1, plate_code: "BK001", plate_name: "算力", strength: 12200 },
            { rank: 2, plate_code: "BK002", plate_name: "芯片", strength: 9800 },
            { rank: 3, plate_code: "BK004", plate_name: "低空", strength: 9100 }
          ]
        },
        {
          date: "2026-05-12",
          items: [
            { rank: 1, plate_code: "BK001", plate_name: "算力", strength: 12100 },
            { rank: 2, plate_code: "BK003", plate_name: "机器人", strength: 9300 },
            { rank: 3, plate_code: "BK004", plate_name: "低空", strength: 9200 }
          ]
        }
      ]
    });

    const cells = model.rankRows.flatMap((row) => row.cells).filter(Boolean);
    const colorByName = new Map(cells.map((cell) => [cell?.name, cell?.colorIndex]));

    expect(colorByName.get("算力")).toBe(0);
    expect(colorByName.get("芯片")).toBe(1);
    expect(colorByName.get("机器人")).toBe(2);
    expect(colorByName.get("低空")).toBe(3);
    expect(model.rankRows[0].cells[0]?.strengthValue).toBe("--");
  });
});
