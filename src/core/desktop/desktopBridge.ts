export type StockLinkOptions = {
  client: "tdx" | "ths";
  symbol: string;
  tdxPath?: string;
  thsPath?: string;
};

export type InstallerUpdateStatus =
  | {
      phase: "idle" | "checking" | "not-available" | "installing";
      appVersion: string;
      info?: unknown;
    }
  | {
      phase: "available" | "downloaded";
      appVersion: string;
      info: unknown;
    }
  | {
      phase: "downloading";
      appVersion: string;
      info?: unknown;
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

type DesktopBridge = {
  appName: string;
  checkForInstallerUpdate?: () => Promise<InstallerUpdateStatus>;
  copyImageDataUrl?: (dataUrl: string) => Promise<{ message: string; success: boolean }>;
  copyText?: (text: string) => Promise<{ message: string; success: boolean }>;
  downloadInstallerUpdate?: () => Promise<InstallerUpdateStatus>;
  getAppVersion?: () => Promise<{ version: string; isPackaged: boolean }>;
  getUpdateStatus?: () => Promise<InstallerUpdateStatus>;
  getWindowState?: () => Promise<WindowState>;
  getMachineCode?: () => Promise<{ machineCode: string; version: string }>;
  installInstallerUpdate?: () => Promise<InstallerUpdateStatus>;
  onUpdateStatus?: (listener: (status: InstallerUpdateStatus) => void) => () => void;
  onWindowStateChange?: (listener: (state: WindowState) => void) => () => void;
  openExternal?: (url: string) => Promise<{ message: string; success: boolean }>;
  openStock?: (options: StockLinkOptions) => Promise<{ message: string; success: boolean }>;
  saveFile?: (options: { bytes?: number[]; content?: string; defaultPath: string }) => Promise<{ canceled?: boolean; filePath?: string; message: string; success: boolean }>;
  windowControl?: (action: WindowControlAction) => Promise<{ message: string; success: boolean }>;
};

export type WindowControlAction = "close" | "minimize" | "toggle-maximize";
export type WindowState = { isFullScreen: boolean; isMaximized: boolean };

const fallbackUpdateStatus: InstallerUpdateStatus = {
  phase: "idle",
  appVersion: "0.1.0"
};

export async function copyText(text: string): Promise<string> {
  if (window.niuniu?.copyText) {
    const result = await window.niuniu.copyText(text);
    return result.message;
  }
  await navigator.clipboard.writeText(text);
  return "内容已复制到剪贴板";
}

export async function copyImageDataUrl(dataUrl: string): Promise<string> {
  if (window.niuniu?.copyImageDataUrl) {
    const result = await window.niuniu.copyImageDataUrl(dataUrl);
    return result.message;
  }
  const blob = await (await fetch(dataUrl)).blob();
  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  return "图片已复制到剪贴板";
}

export async function saveFile(defaultPath: string, content: string | Uint8Array): Promise<string> {
  if (window.niuniu?.saveFile) {
    const result = await window.niuniu.saveFile(
      typeof content === "string"
        ? { content, defaultPath }
        : { bytes: Array.from(content), defaultPath }
    );
    return result.canceled ? "已取消保存" : result.message;
  }

  const blob =
    typeof content === "string"
      ? new Blob([content])
      : new Blob([copyToArrayBuffer(content)]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = defaultPath;
  link.click();
  URL.revokeObjectURL(url);
  return "文件已开始下载";
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function openExternal(url: string): Promise<string> {
  if (window.niuniu?.openExternal) {
    const result = await window.niuniu.openExternal(url);
    return result.message;
  }
  window.open(url, "_blank", "noopener,noreferrer");
  return "已打开外部链接";
}

export async function openStock(options: StockLinkOptions): Promise<string> {
  if (window.niuniu?.openStock) {
    const result = await window.niuniu.openStock(options);
    return result.message;
  }
  return "当前浏览器预览模式无法联动股票客户端，请在 Electron 桌面端使用。";
}

export async function controlWindow(action: WindowControlAction): Promise<string> {
  if (window.niuniu?.windowControl) {
    const result = await window.niuniu.windowControl(action);
    return result.message;
  }
  return "当前浏览器预览模式不支持窗口控制。";
}

export function supportsWindowStateBridge(): boolean {
  return Boolean(window.niuniu?.getWindowState || window.niuniu?.onWindowStateChange);
}

export async function getWindowState(): Promise<WindowState> {
  return window.niuniu?.getWindowState?.() ?? { isFullScreen: false, isMaximized: false };
}

export function onWindowStateChange(listener: (state: WindowState) => void): () => void {
  return window.niuniu?.onWindowStateChange?.(listener) ?? (() => undefined);
}

export async function getDesktopMachineCode(): Promise<{ machineCode: string; version: string } | undefined> {
  return window.niuniu?.getMachineCode?.();
}

export async function getAppVersion(): Promise<{ version: string; isPackaged: boolean }> {
  return window.niuniu?.getAppVersion?.() ?? { version: "0.1.0", isPackaged: false };
}

export async function getUpdateStatus(): Promise<InstallerUpdateStatus> {
  return window.niuniu?.getUpdateStatus?.() ?? fallbackUpdateStatus;
}

export async function checkForInstallerUpdate(): Promise<InstallerUpdateStatus> {
  return window.niuniu?.checkForInstallerUpdate?.() ?? fallbackUpdateStatus;
}

export async function downloadInstallerUpdate(): Promise<InstallerUpdateStatus> {
  return window.niuniu?.downloadInstallerUpdate?.() ?? fallbackUpdateStatus;
}

export async function installInstallerUpdate(): Promise<InstallerUpdateStatus> {
  return window.niuniu?.installInstallerUpdate?.() ?? fallbackUpdateStatus;
}

export function onUpdateStatus(listener: (status: InstallerUpdateStatus) => void): () => void {
  return window.niuniu?.onUpdateStatus?.(listener) ?? (() => undefined);
}
