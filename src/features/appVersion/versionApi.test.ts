import { describe, expect, it, vi } from "vitest";
import { checkLatestAppVersion } from "./versionApi";

describe("checkLatestAppVersion", () => {
  it("calls the signed version endpoint with current version", async () => {
    const getMap = vi.fn().mockResolvedValue({
      current_version: "0.1.0",
      latest_version: "0.2.0",
      platform: "win",
      has_update: true,
      force_update: false,
      download_url: "https://example.com/electron_niuniu-0.2.0-setup.exe",
      file_size: 1048576,
      sha256: "",
      release_notes_markdown: "## 更新内容\n- 优化版本更新体验",
      release_notes_text: "",
      published_at: "2026-05-18T08:00:00+08:00"
    });

    const result = await checkLatestAppVersion({ client: { getMap }, currentVersion: "0.1.0" });

    expect(getMap).toHaveBeenCalledWith("/api/v1/app/version/latest?platform=win&current_version=0.1.0");
    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe("0.2.0");
    expect(result.releaseNotesMarkdown).toBe("## 更新内容\n- 优化版本更新体验");
    expect(result.fileSize).toBe(1048576);
  });

  it("normalizes missing optional fields to stable defaults", async () => {
    const getMap = vi.fn().mockResolvedValue({
      current_version: "0.2.0",
      latest_version: "0.2.0",
      platform: "win",
      has_update: false,
      force_update: false
    });

    const result = await checkLatestAppVersion({ client: { getMap }, currentVersion: "0.2.0" });

    expect(result).toMatchObject({
      currentVersion: "0.2.0",
      latestVersion: "0.2.0",
      platform: "win",
      hasUpdate: false,
      forceUpdate: false,
      downloadUrl: "",
      fileSize: null,
      releaseNotesMarkdown: "",
      releaseNotesText: "",
      publishedAt: null
    });
  });
});
