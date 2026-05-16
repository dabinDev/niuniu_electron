import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, nativeTheme, shell } from "electron";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

app.setName("牛牛开盘");
if (!isDev) {
  app.setPath("userData", path.join(app.getPath("appData"), "NiuNiuElectronClient"));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    title: "牛牛开盘 Review Studio",
    frame: false,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: "#00000000",
    transparent: true,
    autoHideMenuBar: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.once("ready-to-show", () => {
    win.show();
    sendWindowState(win);
  });

  win.on("maximize", () => sendWindowState(win));
  win.on("unmaximize", () => sendWindowState(win));
  win.on("enter-full-screen", () => sendWindowState(win));
  win.on("leave-full-screen", () => sendWindowState(win));
  win.on("restore", () => sendWindowState(win));

  if (isDev) {
    void win.loadURL("http://127.0.0.1:5173");
  } else {
    void win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

function windowState(win: BrowserWindow) {
  return {
    isFullScreen: win.isFullScreen(),
    isMaximized: win.isMaximized()
  };
}

function sendWindowState(win: BrowserWindow) {
  win.webContents.send("niuniu:window-state-changed", windowState(win));
}

ipcMain.handle("niuniu:copy-text", async (_event, text: string) => {
  clipboard.writeText(String(text ?? ""));
  return { success: true, message: "内容已复制到剪贴板" };
});

ipcMain.handle("niuniu:copy-image-data-url", async (_event, dataUrl: string) => {
  const image = nativeImage.createFromDataURL(dataUrl);
  if (image.isEmpty()) {
    return { success: false, message: "图片内容为空，无法复制" };
  }
  clipboard.writeImage(image);
  return { success: true, message: "图片已复制到剪贴板" };
});

ipcMain.handle("niuniu:save-file", async (_event, options: { bytes?: number[]; content?: string; defaultPath?: string }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: options.defaultPath || "niuniu-export.txt"
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true, success: true, message: "已取消保存" };
  }
  const data = options.bytes ? Buffer.from(options.bytes) : Buffer.from(options.content ?? "", "utf8");
  await writeFile(result.filePath, data);
  return { filePath: result.filePath, success: true, message: `已保存：${result.filePath}` };
});

ipcMain.handle("niuniu:open-external", async (_event, url: string) => {
  await shell.openExternal(url);
  return { success: true, message: "已打开外部链接" };
});

ipcMain.handle("niuniu:window-control", async (event, action: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    return { success: false, message: "窗口不存在" };
  }

  if (action === "minimize") {
    win.minimize();
    return { success: true, message: "已最小化窗口" };
  }

  if (action === "toggle-maximize") {
    if (win.isMaximized()) {
      win.unmaximize();
      return { success: true, message: "已还原窗口" };
    }
    win.maximize();
    return { success: true, message: "已最大化窗口" };
  }

  if (action === "close") {
    win.close();
    return { success: true, message: "已关闭窗口" };
  }

  return { success: false, message: "未知窗口操作" };
});

ipcMain.handle("niuniu:window-state", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    return { isFullScreen: false, isMaximized: false };
  }
  return windowState(win);
});

ipcMain.handle(
  "niuniu:open-stock",
  async (
    _event,
    options: {
      client?: "tdx" | "ths";
      symbol?: string;
      tdxPath?: string;
      thsPath?: string;
    }
  ) => {
    const symbol = String(options.symbol ?? "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(symbol)) {
      return { success: false, message: "请输入 6 位股票代码" };
    }

    const exePath = options.client === "ths" ? options.thsPath : options.tdxPath;
    if (!exePath || !existsSync(exePath)) {
      return { success: false, message: "未配置联动客户端路径，请先在设置中填写通达信或同花顺路径。" };
    }

    spawn(exePath, [symbol], {
      detached: true,
      stdio: "ignore"
    }).unref();
    return { success: true, message: `已联动打开 ${symbol}` };
  }
);

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
