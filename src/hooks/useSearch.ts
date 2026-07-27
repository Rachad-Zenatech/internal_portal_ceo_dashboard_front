import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import type { SearchResult } from "@/types/search";

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!query || query.trim().length === 0) return [];
      return apiClient.get(`/search?q=${encodeURIComponent(query)}`);
    },
    enabled: query.trim().length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
