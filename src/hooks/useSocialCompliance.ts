import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import type {
  ApprovedContentResponse,
  PublicMoodApiResponse,
  PublicMoodScrapeScope,
} from "@/types/socialCompliance";

export function useApprovedComplianceContent(brandCode?: string) {
  const normalized = brandCode && brandCode !== "ALL" ? brandCode : undefined;
  return useQuery<ApprovedContentResponse>({
    queryKey: ["socialCompliance", "approvedContent", normalized ?? "ALL"],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ limit: "2000" });
      if (normalized) params.set("brand_code", normalized);
      return apiClient.get<ApprovedContentResponse>(`/api/v1/ceo/compliance/approved-content?${params.toString()}`, { signal });
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCompliancePublicMood() {
  return useQuery<PublicMoodApiResponse>({
    queryKey: ["socialCompliance", "publicMood"],
    queryFn: ({ signal }) =>
      apiClient.get<PublicMoodApiResponse>("/api/v1/ceo/compliance/public-mood", { signal }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const state = query.state.data?.data?.scrape_state;
      return state === "running" ? 5000 : false;
    },
  });
}

export function useTriggerPublicMoodScrape() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scope: PublicMoodScrapeScope = "all") =>
      apiClient.post<{ status: string; scope: string; message?: string }>(
        `/api/v1/ceo/compliance/public-mood/scrape?scope=${encodeURIComponent(scope)}`
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["socialCompliance", "publicMood"] });
    },
  });
}
