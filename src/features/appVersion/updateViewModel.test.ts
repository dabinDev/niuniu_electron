import { describe, expect, it } from "vitest";
import { formatBytes, formatSpeed, nextUpdatePhaseLabel, updateCanClose } from "./updateViewModel";

describe("updateViewModel", () => {
  it("keeps forced update modal locked", () => {
    expect(updateCanClose({ forceUpdate: true, phase: "available" })).toBe(false);
    expect(updateCanClose({ forceUpdate: true, phase: "error" })).toBe(false);
    expect(updateCanClose({ forceUpdate: false, phase: "available" })).toBe(true);
  });

  it("keeps ordinary update modal locked while installing or downloading", () => {
    expect(updateCanClose({ forceUpdate: false, phase: "downloading" })).toBe(false);
    expect(updateCanClose({ forceUpdate: false, phase: "installing" })).toBe(false);
    expect(updateCanClose({ forceUpdate: false, phase: "error" })).toBe(true);
  });

  it("formats progress values", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatSpeed(2048)).toBe("2.0 KB/s");
  });

  it("labels update phases", () => {
    expect(nextUpdatePhaseLabel("checking")).toBe("正在检查更新");
    expect(nextUpdatePhaseLabel("downloading")).toBe("正在下载更新包");
    expect(nextUpdatePhaseLabel("installing")).toBe("正在静默安装并重启");
  });
});
