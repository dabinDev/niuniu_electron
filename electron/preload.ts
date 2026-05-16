import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("niuniu", {
  appName: "牛牛开盘 Review Studio",
  copyImageDataUrl: (dataUrl: string) => ipcRenderer.invoke("niuniu:copy-image-data-url", dataUrl),
  copyText: (text: string) => ipcRenderer.invoke("niuniu:copy-text", text),
  openExternal: (url: string) => ipcRenderer.invoke("niuniu:open-external", url),
  openStock: (options: unknown) => ipcRenderer.invoke("niuniu:open-stock", options),
  saveFile: (options: unknown) => ipcRenderer.invoke("niuniu:save-file", options),
  windowControl: (action: string) => ipcRenderer.invoke("niuniu:window-control", action),
  getWindowState: () => ipcRenderer.invoke("niuniu:window-state"),
  onWindowStateChange: (listener: (state: unknown) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: unknown) => listener(state);
    ipcRenderer.on("niuniu:window-state-changed", wrapped);
    return () => ipcRenderer.removeListener("niuniu:window-state-changed", wrapped);
  }
});
