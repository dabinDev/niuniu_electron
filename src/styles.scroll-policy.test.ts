import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

describe("page scroll policy", () => {
  it("keeps page-level scrolling instead of common inner panels", () => {
    const policy = styles.slice(styles.indexOf("/* Page-owned vertical scrolling policy */"));
    const innerScrollSelectors = [
      ".data-table",
      ".data-table-body",
      ".answer-panel",
      ".history-list-expanded",
      ".history-markdown",
      ".prompt-preview",
      ".markdown-answer pre",
      ".matrix-scroll",
      ".height-matrix-scroll",
      ".height-date-rail",
      ".node-date-strip",
      ".node-date-list",
      ".tier-tree-workspace",
      ".tier-tree-rows",
      ".yesterday-stats-tabs",
      ".auction-stock-list"
    ];

    for (const selector of innerScrollSelectors) {
      expect(policy).toContain(selector);
    }
    expect(policy).toContain("overflow: visible !important");
    expect(policy).toContain("max-height: none !important");
    expect(policy).toContain(".page-scroll .data-table:not(.review-groups-panel .data-table):not(.market-center-panel .data-table)");
    const horizontalScrollExceptions = policy.match(/overflow-x: auto !important/g) ?? [];
    expect(horizontalScrollExceptions.length).toBeGreaterThanOrEqual(5);
    expect(policy).toMatch(/\.page-scroll \.review-groups-panel \.data-table\s*\{[\s\S]*overflow-x: auto !important/);
    expect(policy).toMatch(/\.page-scroll \.height-matrix-scroll\s*\{[\s\S]*overflow-x: auto !important/);
    expect(policy).toMatch(/\.page-scroll \.matrix-scroll\s*\{[\s\S]*overflow-x: auto !important/);
    expect(policy).toMatch(/\.page-scroll \.node-date-strip\s*\{[\s\S]*overflow-x: auto !important/);
    expect(policy).toMatch(/\.page-scroll \.market-center-panel \.data-table\s*\{[\s\S]*overflow-x: auto !important/);
    expect(policy).not.toContain("overflow-y: auto !important");
  });
});
