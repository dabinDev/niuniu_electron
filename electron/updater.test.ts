import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getVersion: () => "0.1.0",
    isPackaged: false
  },
  BrowserWindow: {
    getAllWindows: () => []
  },
  ipcMain: {
    handle: vi.fn()
  }
}));

vi.mock("electron-updater", () => ({
  default: {
    autoUpdater: {
      autoDownload: false,
      autoInstallOnAppQuit: false,
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      on: vi.fn(),
      quitAndInstall: vi.fn(),
      setFeedURL: vi.fn()
    }
  }
}));

import { feedUrlFromDownloadUrl, updateSourceFromDownloadUrl } from "./updater.js";

describe("feedUrlFromDownloadUrl", () => {
  it("treats installer URLs as direct internal downloads instead of generic latest.yml feeds", () => {
    expect(updateSourceFromDownloadUrl("https://example.com/niuniu/releases/electron_niuniu-0.2.0-setup.exe")).toEqual({
      type: "installer",
      url: "https://example.com/niuniu/releases/electron_niuniu-0.2.0-setup.exe"
    });
    expect(feedUrlFromDownloadUrl("https://example.com/niuniu/releases/electron_niuniu-0.2.0-setup.exe")).toBe("");
  });

  it("keeps query strings on signed installer URLs for direct downloads", () => {
    expect(updateSourceFromDownloadUrl("https://cdn.example.com/app/electron_niuniu.exe?token=abc#download")).toEqual({
      type: "installer",
      url: "https://cdn.example.com/app/electron_niuniu.exe?token=abc"
    });
  });

  it("still supports explicit generic feed directories", () => {
    expect(updateSourceFromDownloadUrl("https://example.com/niuniu/releases/")).toEqual({
      type: "feed",
      url: "https://example.com/niuniu/releases/"
    });
    expect(feedUrlFromDownloadUrl("https://example.com/niuniu/releases/")).toBe("https://example.com/niuniu/releases/");
  });
});
