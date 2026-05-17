import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("updater Electron import", () => {
  it("uses a CommonJS-compatible electron-updater import for packaged ESM", () => {
    const source = readFileSync(resolve(process.cwd(), "electron/updater.ts"), "utf8");

    expect(source).toContain('import electronUpdater, { type ProgressInfo, type UpdateInfo } from "electron-updater"');
    expect(source).not.toContain('import { autoUpdater');
  });
});
