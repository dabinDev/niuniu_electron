import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("niuniu", {
  appName: "牛牛开盘 Review Studio",
  copyImageDataUrl: (dataUrl: string) => ipcRenderer.invoke("niuniu:copy-image-data-url", dataUrl),
  copyText: (text: string) => ipcRenderer.invoke("niuniu:copy-text", text),
  openExternal: (url: string) => ipcRenderer.invoke("niuniu:open-external", url),
  openStock: (options: unknown) => ipcRenderer.invoke("niuniu:open-stock", options),
  saveFile: (options: unknown) => ipcRenderer.invoke("niuniu:save-file", options),
  windowControl: (action: string) => ipcRenderer.invoke("niuniu:window-control", action),
  getAppVersion: () => ipcRenderer.invoke("niuniu:app-version"),
  getUpdateStatus: () => ipcRenderer.invoke("niuniu:update-status"),
  getWindowState: () => ipcRenderer.invoke("niuniu:window-state"),
  getMachineCode: () => ipcRenderer.invoke("niuniu:machine-code"),
  checkForInstallerUpdate: (downloadUrl?: string) => ipcRenderer.invoke("niuniu:update-check", downloadUrl),
  downloadInstallerUpdate: () => ipcRenderer.invoke("niuniu:update-download"),
  installInstallerUpdate: () => ipcRenderer.invoke("niuniu:update-install"),
  onUpdateStatus: (listener: (status: unknown) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, status: unknown) => listener(status);
    ipcRenderer.on("niuniu:update-status", wrapped);
    return () => ipcRenderer.removeListener("niuniu:update-status", wrapped);
  },
  onWindowStateChange: (listener: (state: unknown) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: unknown) => listener(state);
    ipcRenderer.on("niuniu:window-state-changed", wrapped);
    return () => ipcRenderer.removeListener("niuniu:window-state-changed", wrapped);
  }
});
