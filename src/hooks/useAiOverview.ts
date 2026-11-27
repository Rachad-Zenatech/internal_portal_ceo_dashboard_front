import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import type { AiOverviewResponse } from "@/types/aiOverview";

type RawAiOverview = Partial<AiOverviewResponse> & {
  window_hours?: number;
  guards?: AiOverviewResponse["guard"];
  summary?: {
    overall_status?: string;
    features_total?: number;
    features_healthy?: number;
    features_out?: number;
    features_overflow?: number;
    total_calls?: number;
    total_errors?: number;
    total_blocked?: number;
    total_cache_hits?: number;
    total_input_tokens?: number;
    total_output_tokens?: number;
  };
};

function normalizeAiOverview(raw: RawAiOverview, fallbackHours: number): AiOverviewResponse {
  const cores = Array.isArray(raw.cores) ? raw.cores : [];
  const features = Array.isArray(raw.features) ? raw.features : [];
  const summary = raw.summary;
  const totals = raw.totals ?? {
    calls: summary?.total_calls ?? 0,
    errors: summary?.total_errors ?? 0,
    blocked: summary?.total_blocked ?? 0,
    cache_hits: summary?.total_cache_hits ?? 0,
    input_tokens: summary?.total_input_tokens ?? 0,
    output_tokens: summary?.total_output_tokens ?? 0,
    features_total: summary?.features_total ?? features.length,
    features_out: summary?.features_out ?? features.filter((f) => f.status === "OUT").length,
    features_overflow: summary?.features_overflow ?? features.filter((f) => f.status === "OVERFLOW").length,
    features_healthy: summary?.features_healthy ?? features.filter((f) => f.healthy).length,
  };
  const health = raw.health
    ? {
        ...raw.health,
        degraded_features: Array.isArray(raw.health.degraded_features) ? raw.health.degraded_features : [],
      }
    : {
        available: summary?.overall_status !== "OUT",
        reason: null,
        title: summary?.overall_status === "OUT" ? "Primary AI unavailable" : null,
        message: null,
        since: null,
        degraded_features: [],
      };
  return {
    generated_at: raw.generated_at ?? new Date().toISOString(),
    hours: raw.hours ?? raw.window_hours ?? fallbackHours,
    health,
    totals,
    cores,
    features,
    models: Array.isArray(raw.models) ? raw.models : [],
    steps: Array.isArray(raw.steps) ? raw.steps : [],
    guard: Array.isArray(raw.guard) ? raw.guard : Array.isArray(raw.guards) ? raw.guards : [],
  };
}

export function useAiOverview(hours: number) {
  return useQuery({
    queryKey: ["system-security", "ai-overview", hours],
    queryFn: async () => {
      const raw = await apiClient.get<RawAiOverview>(`/api/observability/ai/overview?hours=${hours}`);
      return normalizeAiOverview(raw, hours);
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
