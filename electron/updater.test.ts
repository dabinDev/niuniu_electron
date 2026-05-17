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
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    on: vi.fn(),
    quitAndInstall: vi.fn(),
    setFeedURL: vi.fn()
  }
}));

import { feedUrlFromDownloadUrl } from "./updater.js";

describe("feedUrlFromDownloadUrl", () => {
  it("uses the release directory for generic electron-updater metadata", () => {
    expect(feedUrlFromDownloadUrl("https://example.com/niuniu/releases/electron_niuniu-0.2.0-setup.exe")).toBe(
      "https://example.com/niuniu/releases/"
    );
  });

  it("removes query strings and hashes from installer URLs", () => {
    expect(feedUrlFromDownloadUrl("https://cdn.example.com/app/electron_niuniu.exe?token=abc#download")).toBe(
      "https://cdn.example.com/app/"
    );
  });
});
