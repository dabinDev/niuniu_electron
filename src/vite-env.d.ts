/// <reference types="vite/client" />

interface Window {
  niuniu?: {
    appName: string;
    copyImageDataUrl?: (dataUrl: string) => Promise<{ message: string; success: boolean }>;
    copyText?: (text: string) => Promise<{ message: string; success: boolean }>;
    getWindowState?: () => Promise<{ isFullScreen: boolean; isMaximized: boolean }>;
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
