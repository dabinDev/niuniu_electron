import { describe, expect, it } from "vitest";
import { buildRepeatedPlateTags, normalizeNodeDateItems, resolveSelectedNodeDate, resolveSelectedNodePlate } from "./nodeViewModel";

describe("nodeViewModel", () => {
  const data = {
    date_items: [
      { date: "2026-05-10", top_plates: [{ plate_code: "BK_AI", plate_name: "AI应用", rank: 1 }, { plate_code: "BK_ROBOT", plate_name: "机器人", rank: 2 }] },
      { date: "2026-05-11", top_plates: [{ plate_code: "BK_AI", plate_name: "AI应用", rank: 2 }, { plate_code: "BK_CHIP", plate_name: "芯片", rank: 1 }] },
      { date: "2026-05-12", top_plates: [{ plate_code: "BK_AI", plate_name: "AI应用", rank: 1 }, { plate_code: "BK_CHIP", plate_name: "芯片", rank: 3 }] },
      { date: "2026-05-13", top_plates: [{ plate_code: "BK_ROBOT", plate_name: "机器人", rank: 1 }] }
    ]
  };

  it("sorts repeated plates across the latest 21 days by frequency and rank strength", () => {
    const items = normalizeNodeDateItems(data);
    const tags = buildRepeatedPlateTags(items);

    expect(tags.map((tag) => [tag.name, tag.count, tag.tone])).toEqual([
      ["AI应用", 3, "hot"],
      ["机器人", 2, "warm"],
      ["芯片", 2, "warm"]
    ]);
  });

  it("resolves selected date and selected plate from current data", () => {
    const items = normalizeNodeDateItems(data);

    expect(resolveSelectedNodeDate(items, "2026-01-01", "2026-05-11")).toBe("2026-05-11");
    expect(resolveSelectedNodeDate(items, "2026-01-01")).toBe("2026-05-13");
    expect(resolveSelectedNodePlate(items[1], "BK_CHIP")).toEqual({ code: "BK_CHIP", name: "芯片" });
    expect(resolveSelectedNodePlate(items[1], "missing")).toEqual({ code: "BK_AI", name: "AI应用" });
  });
});
