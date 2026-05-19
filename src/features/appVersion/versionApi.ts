import type { ApiClient, JsonRecord } from "../../core/api/apiClient";

export interface AppVersionCheckResult {
  currentVersion: string;
  latestVersion: string;
  platform: "win";
  hasUpdate: boolean;
  forceUpdate: boolean;
  downloadUrl: string;
  fileSize: number | null;
  sha256: string;
  releaseNotesText: string;
  releaseNotesMarkdown: string;
  publishedAt: string | null;
}

export async function checkLatestAppVersion(options: {
  client: Pick<ApiClient, "getMap">;
  currentVersion: string;
}): Promise<AppVersionCheckResult> {
  const params = new URLSearchParams({ platform: "win", current_version: options.currentVersion });
  const payload = await options.client.getMap(`/api/v1/app/version/latest?${params.toString()}`);
  return normalizeVersionCheck(payload);
}

function normalizeVersionCheck(payload: JsonRecord): AppVersionCheckResult {
  const currentVersion = stringValue(payload.current_version);
  const latestVersion = stringValue(payload.latest_version);
  const isNewer = compareSemanticVersions(latestVersion, currentVersion) > 0;
  const hasUpdate = booleanValue(payload.has_update) && isNewer;
  const forceUpdate = hasUpdate && booleanValue(payload.force_update);
  return {
    currentVersion,
    latestVersion,
    platform: "win",
    hasUpdate,
    forceUpdate,
    downloadUrl: hasUpdate ? stringValue(payload.download_url) : "",
    fileSize: hasUpdate && typeof payload.file_size === "number" ? payload.file_size : null,
    sha256: hasUpdate ? stringValue(payload.sha256) : "",
    releaseNotesText: hasUpdate ? stringValue(payload.release_notes_text) : "",
    releaseNotesMarkdown: hasUpdate ? stringValue(payload.release_notes_markdown) : "",
    publishedAt: payload.published_at ? stringValue(payload.published_at) : null
  };
}

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function booleanValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
  }
  return false;
}

function compareSemanticVersions(left: string, right: string): number {
  const leftParts = parseSemanticVersion(left);
  const rightParts = parseSemanticVersion(right);
  if (!leftParts || !rightParts) {
    return left === right ? 0 : -1;
  }
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] > rightParts[index]) {
      return 1;
    }
    if (leftParts[index] < rightParts[index]) {
      return -1;
    }
  }
  return 0;
}

function parseSemanticVersion(value: string): [number, number, number] | null {
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
