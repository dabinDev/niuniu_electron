export type UpdateModalPhase =
  | "available"
  | "checking"
  | "downloading"
  | "downloaded"
  | "error"
  | "installing"
  | "not-available";

export function updateCanClose(state: { forceUpdate: boolean; phase: UpdateModalPhase }): boolean {
  if (state.forceUpdate) {
    return false;
  }
  return state.phase !== "downloading" && state.phase !== "installing";
}

export function nextUpdatePhaseLabel(phase: UpdateModalPhase): string {
  const labels: Record<UpdateModalPhase, string> = {
    available: "发现可用更新",
    checking: "正在检查更新",
    downloading: "正在下载更新包",
    downloaded: "下载完成，准备安装",
    error: "更新失败",
    installing: "正在静默安装并重启",
    "not-available": "当前已是最新版本"
  };
  return labels[phase];
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  if (value < 1024) {
    return `${Math.round(value)} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function formatSpeed(value: number): string {
  return `${formatBytes(value)}/s`;
}
