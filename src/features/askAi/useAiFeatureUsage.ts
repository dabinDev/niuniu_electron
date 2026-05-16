import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useApiClient } from "../../core/api/useApiClient";
import { type AiFeatureKey, getAiFeatureUsage, loadOrCreateAskAiClientId } from "./askAiSettings";

export function useAiFeatureUsage(feature: AiFeatureKey) {
  const client = useApiClient();
  const clientId = useMemo(() => loadOrCreateAskAiClientId(), []);
  const query = useQuery({
    queryFn: () => client.getMap(`/api/v1/ask-ai/usage-status?client_id=${encodeURIComponent(clientId)}`),
    queryKey: ["ask-ai", "usage-status", clientId]
  });

  return {
    clientId,
    query,
    usage: getAiFeatureUsage(query.data, feature)
  };
}
