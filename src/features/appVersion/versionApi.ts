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
  return {
    currentVersion: stringValue(payload.current_version),
    latestVersion: stringValue(payload.latest_version),
    platform: "win",
    hasUpdate: Boolean(payload.has_update),
    forceUpdate: Boolean(payload.force_update),
    downloadUrl: stringValue(payload.download_url),
    fileSize: typeof payload.file_size === "number" ? payload.file_size : null,
    sha256: stringValue(payload.sha256),
    releaseNotesText: stringValue(payload.release_notes_text),
    releaseNotesMarkdown: stringValue(payload.release_notes_markdown),
    publishedAt: payload.published_at ? stringValue(payload.published_at) : null
  };
}

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}
