import { useMemo } from "react";
import { usePreferencesStore } from "../../app/preferencesStore";
import { ApiClient } from "./apiClient";

export function useApiClient(): ApiClient {
  const apiBaseUrl = usePreferencesStore((state) => state.apiBaseUrl);
  const accessActivation = usePreferencesStore((state) => state.accessActivation);
  return useMemo(
    () => new ApiClient({ accessProvider: () => accessActivation, baseUrl: apiBaseUrl }),
    [accessActivation, apiBaseUrl]
  );
}

export function useApiBaseUrl(): string {
  return usePreferencesStore((state) => state.apiBaseUrl);
}
