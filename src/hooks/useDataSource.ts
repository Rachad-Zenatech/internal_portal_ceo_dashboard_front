import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { getDataSource } from "@/lib/dataSources";
import type { DataRow } from "@/types/customize";

/**
 * Live pass-through read of a catalog data source. The query key starts with the source's namespace
 * (e.g. "ma", "admin"), so the realtime handler that invalidates those namespaces refreshes the widget.
 */
export function useDataSource(sourceId: string) {
  const source = getDataSource(sourceId);

  const query = useQuery<unknown>({
    queryKey: [source?.queryNamespace ?? "datasource", "ds", sourceId],
    queryFn: ({ signal }) => apiClient.get<unknown>(source!.endpoint, { signal }),
    enabled: Boolean(source),
    staleTime: 30000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  const rows: DataRow[] = useMemo(() => (source && query.data !== undefined ? source.toRows(query.data) : []), [source, query.data]);

  return { source, rows, isLoading: query.isLoading, isError: query.isError || !source, isFetching: query.isFetching, refetch: query.refetch };
}
