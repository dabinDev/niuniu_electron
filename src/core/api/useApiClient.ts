import { useMemo } from "react";
import { usePreferencesStore } from "../../app/preferencesStore";
import { ApiClient } from "./apiClient";

export function useApiClient(): ApiClient {
  const apiBaseUrl = usePreferencesStore((state) => state.apiBaseUrl);
  return useMemo(() => new ApiClient({ baseUrl: apiBaseUrl }), [apiBaseUrl]);
}

export function useApiBaseUrl(): string {
  return usePreferencesStore((state) => state.apiBaseUrl);
}
