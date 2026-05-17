/// <reference types="vite/client" />

type InstallerUpdateStatus =
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

interface Window {
  niuniu?: {
    appName: string;
    checkForInstallerUpdate?: () => Promise<InstallerUpdateStatus>;
    copyImageDataUrl?: (dataUrl: string) => Promise<{ message: string; success: boolean }>;
    copyText?: (text: string) => Promise<{ message: string; success: boolean }>;
    downloadInstallerUpdate?: () => Promise<InstallerUpdateStatus>;
    getAppVersion?: () => Promise<{ version: string; isPackaged: boolean }>;
    getUpdateStatus?: () => Promise<InstallerUpdateStatus>;
    getWindowState?: () => Promise<{ isFullScreen: boolean; isMaximized: boolean }>;
    getMachineCode?: () => Promise<{ machineCode: string; version: string }>;
    installInstallerUpdate?: () => Promise<InstallerUpdateStatus>;
    onUpdateStatus?: (listener: (status: InstallerUpdateStatus) => void) => () => void;
    onWindowStateChange?: (listener: (state: { isFullScreen: boolean; isMaximized: boolean }) => void) => () => void;
    openExternal?: (url: string) => Promise<{ message: string; success: boolean }>;
    openStock?: (options: {
      client: "tdx" | "ths";
      symbol: string;
      tdxPath?: string;
      thsPath?: string;
    }) => Promise<{ message: string; success: boolean }>;
    saveFile?: (options: {
      bytes?: number[];
      content?: string;
      defaultPath: string;
    }) => Promise<{ canceled?: boolean; filePath?: string; message: string; success: boolean }>;
    windowControl?: (action: "close" | "minimize" | "toggle-maximize") => Promise<{ message: string; success: boolean }>;
  };
}
