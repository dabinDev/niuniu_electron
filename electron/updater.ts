import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater, type ProgressInfo, type UpdateInfo } from "electron-updater";

export type UpdateStatus =
  | {
      status: "idle" | "checking" | "not-available" | "installing";
      appVersion: string;
      info?: UpdateInfo;
    }
  | {
      status: "available" | "downloaded";
      appVersion: string;
      info: UpdateInfo;
    }
  | {
      status: "downloading";
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
      status: "error";
      appVersion: string;
      error: string;
    };

let latestStatus: UpdateStatus = {
  status: "idle",
  appVersion: app.getVersion()
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

export function registerUpdaterIpc() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    setStatus({ status: "checking", appVersion: appVersion() });
  });

  autoUpdater.on("update-available", (info) => {
    setStatus({ status: "available", appVersion: appVersion(), info });
  });

  autoUpdater.on("update-not-available", (info) => {
    setStatus({ status: "not-available", appVersion: appVersion(), info });
  });

  autoUpdater.on("download-progress", (progress) => {
    setStatus({
      status: "downloading",
      appVersion: appVersion(),
      progress: toProgress(progress)
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setStatus({ status: "downloaded", appVersion: appVersion(), info });
  });

  autoUpdater.on("error", (error) => {
    setStatus({
      status: "error",
      appVersion: appVersion(),
      error: error instanceof Error ? error.message : String(error)
    });
  });

  ipcMain.handle("niuniu:app-version", async () => ({
    version: appVersion(),
    isPackaged: app.isPackaged
  }));

  ipcMain.handle("niuniu:update-status", async () => latestStatus);

  ipcMain.handle("niuniu:update-check", async () => {
    if (!app.isPackaged) {
      setStatus({ status: "not-available", appVersion: appVersion() });
      return latestStatus;
    }
    await autoUpdater.checkForUpdates();
    return latestStatus;
  });

  ipcMain.handle("niuniu:update-download", async () => {
    if (!app.isPackaged) {
      setStatus({
        status: "downloading",
        appVersion: appVersion(),
        progress: {
          percent: 100,
          transferred: 1,
          total: 1,
          bytesPerSecond: 0
        }
      });
      setStatus({
        status: "downloaded",
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
    await autoUpdater.downloadUpdate();
    return latestStatus;
  });

  ipcMain.handle("niuniu:update-install", async () => {
    setStatus({ status: "installing", appVersion: appVersion() });
    if (app.isPackaged) {
      autoUpdater.quitAndInstall(false, true);
    }
    return latestStatus;
  });
}
