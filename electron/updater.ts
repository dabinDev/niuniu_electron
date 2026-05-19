import { app, BrowserWindow, ipcMain } from "electron";
import electronUpdater, { type ProgressInfo, type UpdateInfo } from "electron-updater";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";

const { autoUpdater } = electronUpdater;

export type UpdateStatus =
  | {
      phase: "idle" | "checking" | "not-available" | "installing";
      appVersion: string;
      info?: UpdateInfo;
    }
  | {
      phase: "available" | "downloaded";
      appVersion: string;
      info: UpdateInfo;
    }
  | {
      phase: "downloading";
      appVersion: string;
      info?: UpdateInfo;
      progress: {
        percent: number;
        transferred: number;
        total: number;
        bytesPerSecond: number;
      };
    }
  | {
      phase: "error";
      appVersion: string;
      error: string;
    };

let latestStatus: UpdateStatus = {
  phase: "idle",
  appVersion: app.getVersion()
};
let configuredFeedUrl = "";
let directInstallerUrl = "";
let directInstallerPath = "";
let directUpdateInfo: UpdateInfo | undefined;

type UpdateSource =
  | {
      type: "feed" | "installer";
      url: string;
    }
  | {
      type: "none";
      url: "";
    };

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

function setStatus(status: UpdateStatus) {
  latestStatus = status;
  broadcast("niuniu:update-status", latestStatus);
}

function toProgress(progress: ProgressInfo) {
  return {
    percent: progress.percent,
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond
  };
}

function appVersion() {
  return app.getVersion();
}

export function feedUrlFromDownloadUrl(downloadUrl: string): string {
  const source = updateSourceFromDownloadUrl(downloadUrl);
  return source.type === "feed" ? source.url : "";
}

export function updateSourceFromDownloadUrl(downloadUrl: string | undefined): UpdateSource {
  if (!downloadUrl) {
    return { type: "none", url: "" };
  }
  const trimmed = downloadUrl.trim();
  if (!trimmed) {
    return { type: "none", url: "" };
  }
  const parsed = new URL(trimmed);
  parsed.hash = "";
  const pathname = parsed.pathname.toLowerCase();
  if (/\.(exe|msi)$/i.test(pathname)) {
    return { type: "installer", url: parsed.toString() };
  }
  if (pathname.endsWith(".yml") || pathname.endsWith(".yaml")) {
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/[^/]*$/, "");
    return { type: "feed", url: parsed.toString() };
  }
  if (!pathname || pathname.endsWith("/")) {
    return { type: "feed", url: parsed.toString() };
  }
  return { type: "installer", url: parsed.toString() };
}

function configureUpdateSource(downloadUrl: string | undefined): UpdateSource {
  if (!downloadUrl) {
    return { type: "none", url: "" };
  }
  const source = updateSourceFromDownloadUrl(downloadUrl);
  if (source.type === "installer") {
    directInstallerUrl = source.url;
    directInstallerPath = "";
    directUpdateInfo = createDirectUpdateInfo(source.url);
    configuredFeedUrl = "";
    return source;
  }
  directInstallerUrl = "";
  directInstallerPath = "";
  directUpdateInfo = undefined;
  if (source.type === "feed" && source.url && source.url !== configuredFeedUrl) {
    autoUpdater.setFeedURL({ provider: "generic", url: source.url });
    configuredFeedUrl = source.url;
  }
  return source;
}

function createDirectUpdateInfo(downloadUrl: string): UpdateInfo {
  return {
    version: updateVersionFromStatus() || appVersion(),
    files: [
      {
        url: downloadUrl,
        sha512: ""
      }
    ],
    path: installerFileName(downloadUrl),
    sha512: "",
    releaseDate: new Date().toISOString()
  };
}

function updateVersionFromStatus(): string {
  if ((latestStatus.phase === "available" || latestStatus.phase === "downloaded") && latestStatus.info?.version) {
    return latestStatus.info.version;
  }
  return "";
}

function installerFileName(downloadUrl: string): string {
  const parsed = new URL(downloadUrl);
  const name = path.basename(parsed.pathname);
  return name && /\.(exe|msi)$/i.test(name) ? name : "electron_niuniu_update.exe";
}

function updateTempDir(): string {
  return path.join(typeof app.getPath === "function" ? app.getPath("temp") : os.tmpdir(), "niuniu-updates");
}

async function downloadDirectInstaller() {
  if (!directInstallerUrl) {
    throw new Error("未找到内部下载地址，请先重新检查版本更新");
  }
  const info = directUpdateInfo ?? createDirectUpdateInfo(directInstallerUrl);
  const outputDir = updateTempDir();
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, installerFileName(directInstallerUrl));
  await rm(outputPath, { force: true });
  setStatus({
    appVersion: appVersion(),
    info,
    phase: "downloading",
    progress: {
      bytesPerSecond: 0,
      percent: 0,
      total: 0,
      transferred: 0
    }
  });
  directInstallerPath = await downloadFile(directInstallerUrl, outputPath, info);
  setStatus({
    appVersion: appVersion(),
    info,
    phase: "downloaded"
  });
  return latestStatus;
}

function downloadFile(url: string, outputPath: string, info: UpdateInfo, redirectCount = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error("更新包下载重定向次数过多"));
      return;
    }
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const request = client.get(parsed, { headers: { "User-Agent": "NiuNiuElectronUpdater" } }, (response) => {
      const statusCode = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(statusCode) && response.headers.location) {
        response.resume();
        const redirected = new URL(response.headers.location, parsed).toString();
        downloadFile(redirected, outputPath, info, redirectCount + 1).then(resolve, reject);
        return;
      }
      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`更新包下载失败：HTTP ${statusCode}`));
        return;
      }

      const total = Number(response.headers["content-length"] ?? 0) || 0;
      const startedAt = Date.now();
      let transferred = 0;
      const file = createWriteStream(outputPath);

      response.on("data", (chunk: Buffer) => {
        transferred += chunk.length;
        const seconds = Math.max((Date.now() - startedAt) / 1000, 0.1);
        setStatus({
          appVersion: appVersion(),
          info,
          phase: "downloading",
          progress: {
            bytesPerSecond: Math.round(transferred / seconds),
            percent: total > 0 ? (transferred / total) * 100 : 0,
            total,
            transferred
          }
        });
      });
      response.on("error", (error) => {
        file.destroy();
        reject(error);
      });
      file.on("error", reject);
      file.on("finish", () => {
        file.close(() => resolve(outputPath));
      });
      response.pipe(file);
    });
    request.setTimeout(120000, () => request.destroy(new Error("更新包下载超时")));
    request.on("error", reject);
  });
}

export function registerUpdaterIpc() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    setStatus({ phase: "checking", appVersion: appVersion() });
  });

  autoUpdater.on("update-available", (info) => {
    setStatus({ phase: "available", appVersion: appVersion(), info });
  });

  autoUpdater.on("update-not-available", (info) => {
    setStatus({ phase: "not-available", appVersion: appVersion(), info });
  });

  autoUpdater.on("download-progress", (progress) => {
    setStatus({
      phase: "downloading",
      appVersion: appVersion(),
      progress: toProgress(progress)
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setStatus({ phase: "downloaded", appVersion: appVersion(), info });
  });

  autoUpdater.on("error", (error) => {
    setStatus({
      phase: "error",
      appVersion: appVersion(),
      error: error instanceof Error ? error.message : String(error)
    });
  });

  ipcMain.handle("niuniu:app-version", async () => ({
    version: appVersion(),
    isPackaged: app.isPackaged
  }));

  ipcMain.handle("niuniu:update-status", async () => latestStatus);

  ipcMain.handle("niuniu:update-check", async (_event, downloadUrl?: string) => {
    if (!app.isPackaged) {
      setStatus({ phase: "not-available", appVersion: appVersion() });
      return latestStatus;
    }
    const source = configureUpdateSource(downloadUrl);
    if (source.type === "installer") {
      setStatus({ phase: "available", appVersion: appVersion(), info: directUpdateInfo ?? createDirectUpdateInfo(source.url) });
      return latestStatus;
    }
    if (source.type === "none" && !configuredFeedUrl) {
      setStatus({ phase: "not-available", appVersion: appVersion() });
      return latestStatus;
    }
    await autoUpdater.checkForUpdates();
    return latestStatus;
  });

  ipcMain.handle("niuniu:update-download", async () => {
    if (!app.isPackaged) {
      setStatus({
        phase: "downloading",
        appVersion: appVersion(),
        progress: {
          percent: 100,
          transferred: 1,
          total: 1,
          bytesPerSecond: 0
        }
      });
      setStatus({
        phase: "downloaded",
        appVersion: appVersion(),
        info: {
          version: appVersion(),
          files: [],
          path: "",
          sha512: "",
          releaseDate: new Date().toISOString()
        }
      });
      return latestStatus;
    }
    if (directInstallerUrl) {
      return downloadDirectInstaller();
    }
    await autoUpdater.downloadUpdate();
    return latestStatus;
  });

  ipcMain.handle("niuniu:update-install", async () => {
    setStatus({ phase: "installing", appVersion: appVersion() });
    if (app.isPackaged) {
      if (directInstallerPath) {
        spawn(directInstallerPath, ["--updated", "/S", "--force-run"], {
          detached: true,
          stdio: "ignore",
          windowsHide: true
        }).unref();
        app.quit();
      } else {
        autoUpdater.quitAndInstall(false, true);
      }
    }
    return latestStatus;
  });
}
