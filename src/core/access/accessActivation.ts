import type { AccessActivation, InviteAccessMode } from "../../app/preferencesStore";
import { ApiClient } from "../api/apiClient";
import { isRecord } from "../api/apiClient";
import type { MachineCodeInfo } from "./machineCode";

export async function activateAccess(options: {
  accessCode: string;
  apiBaseUrl: string;
  machine: MachineCodeInfo;
  mode: InviteAccessMode;
}): Promise<AccessActivation> {
  const client = new ApiClient({ baseUrl: options.apiBaseUrl });
  const response = await client.postMap("/api/v1/access/activate", {
    access_code: options.accessCode,
    access_type: options.mode,
    machine_code: options.machine.machineCode,
    machine_code_version: options.machine.version
  });
  return normalizeActivation(response, options.mode);
}

export async function applyTrialAccess(options: {
  apiBaseUrl: string;
  machine: MachineCodeInfo;
}): Promise<AccessActivation> {
  const client = new ApiClient({ baseUrl: options.apiBaseUrl });
  const response = await client.postMap("/api/v1/access/trial/apply", {
    machine_code: options.machine.machineCode,
    machine_code_version: options.machine.version
  });
  return normalizeActivation(response, "trial");
}

function normalizeActivation(value: Record<string, unknown>, fallbackMode: InviteAccessMode): AccessActivation {
  return {
    accessId: stringValue(value.access_id),
    accessMode: value.access_type === "invite" || value.access_type === "trial" ? value.access_type : fallbackMode,
    accessRole: normalizeAccessRole(value.access_role || value.role),
    activatedAt: stringValue(value.activated_at),
    activationSecret: stringValue(value.activation_secret),
    machineCode: stringValue(value.machine_code),
    machineCodeVersion: stringValue(value.machine_code_version || "win-v1")
  };
}

function normalizeAccessRole(value: unknown): AccessActivation["accessRole"] {
  const normalized = stringValue(value).toLowerCase();
  if (normalized === "admin" || normalized === "operator" || normalized === "owner") {
    return normalized;
  }
  return "user";
}

function stringValue(value: unknown): string {
  if (isRecord(value)) {
    return "";
  }
  return String(value ?? "").trim();
}
