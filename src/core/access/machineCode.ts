const FALLBACK_KEY = "niuniu-browser-machine-code";

export type MachineCodeInfo = {
  machineCode: string;
  version: string;
};

export async function getMachineCodeInfo(): Promise<MachineCodeInfo> {
  const bridged = await window.niuniu?.getMachineCode?.();
  if (bridged?.machineCode) {
    return {
      machineCode: bridged.machineCode.trim().toUpperCase(),
      version: bridged.version || "win-v1"
    };
  }
  const existing = window.localStorage.getItem(FALLBACK_KEY);
  if (existing) {
    return { machineCode: existing, version: "browser-v1" };
  }
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const value = `NN-BROWSER-${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  window.localStorage.setItem(FALLBACK_KEY, value);
  return { machineCode: value, version: "browser-v1" };
}
