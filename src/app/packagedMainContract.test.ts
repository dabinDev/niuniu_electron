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

  it("keeps platform package configuration separated for Windows and macOS builds", () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      build: {
        artifactName?: string;
        electronDist?: string;
        mac?: {
          artifactName?: string;
          icon?: string;
          target?: string[];
        };
        win?: {
          artifactName?: string;
          icon?: string;
        };
      };
      scripts: Record<string, string>;
    };

    expect(packageJson.build.electronDist).toBeUndefined();
    expect(packageJson.build.artifactName).toBeUndefined();
    expect(packageJson.build.win?.artifactName).toBe("electron_niuniu.exe");
    expect(packageJson.build.win?.icon).toBe("build/icon.ico");
    expect(packageJson.build.mac?.artifactName).toBe("electron_niuniu-${version}-${arch}.${ext}");
    expect(packageJson.build.mac?.icon).toBe("build/icon.icns");
    expect(packageJson.build.mac?.target).toEqual(["dmg", "zip"]);
    expect(packageJson.scripts["icon:generate"]).toContain("scripts/generate-niuniu-icon.mjs");
    expect(packageJson.scripts["package:win"]).toContain("--config.electronDist=node_modules/electron/dist");
    expect(packageJson.scripts["package:win"]).toContain("npm run icon:generate");
    expect(packageJson.scripts["package:win:portable"]).toContain("--config.electronDist=node_modules/electron/dist");
    expect(packageJson.scripts["package:mac:x64"]).toContain("npm run icon:generate");
    expect(packageJson.scripts["package:mac:x64"]).toContain("electron-builder --mac dmg zip --x64");
    expect(packageJson.scripts["package:mac:arm64"]).toContain("electron-builder --mac dmg zip --arm64");
  });

  it("provides a macOS CI package workflow for hosts that cannot build macOS locally", () => {
    const workflow = readFileSync(resolve(process.cwd(), "..", ".github", "workflows", "package-niuniu-electron-macos.yml"), "utf8");

    expect(workflow).toContain("runs-on: macos-latest");
    expect(workflow).toContain("working-directory: niuniu_electron");
    expect(workflow).toContain("npm run package:mac:${{ inputs.arch }}");
    expect(workflow).toContain("path: niuniu_electron/release/electron_niuniu-*");
  });
});
