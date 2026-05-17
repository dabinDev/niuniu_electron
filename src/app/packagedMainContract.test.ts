import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("packaged Electron main entry", () => {
  it("uses the Windows asar path shape produced by electron-builder on this project", () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      main: string;
    };

    expect(packageJson.main).toBe("dist\\electron\\main.js");
  });
});
