import { useMemo } from "react";
import { useDataSource } from "@/hooks/useDataSource";
import { groupRows } from "@/lib/aggregate";
import { applyFilter } from "@/lib/widgetLogic";
import type { DataColumn, WidgetConfig } from "@/types/customize";

/** Everything a widget needs to draw itself: live rows (filtered), grouped chart points and its columns. */
export function useWidgetData(widget: WidgetConfig) {
  const { source, rows: allRows, isLoading, isError, isFetching, refetch } = useDataSource(widget.sourceId);
  const rows = useMemo(() => applyFilter(allRows, widget.filter), [allRows, widget.filter]);

  const columnByKey = useMemo(() => new Map<string, DataColumn>((source?.columns ?? []).map((c) => [c.key, c])), [source]);
  const dimension = widget.dimension ? columnByKey.get(widget.dimension) : undefined;
  const measure = widget.measure ? columnByKey.get(widget.measure) : undefined;

  const isGrouped = ["bar", "hbar", "line", "area", "pie", "ranking"].includes(widget.kind);
  const defaultLimit = widget.kind === "ranking" ? 8 : 12;
  const points = useMemo(
    () => (isGrouped ? groupRows(rows, dimension, widget.measure, widget.aggregation, widget.limit ?? defaultLimit) : []),
    [isGrouped, rows, dimension, widget.measure, widget.aggregation, widget.limit, defaultLimit],
  );

  return { source, rows, allRows, columnByKey, dimension, measure, points, isLoading, isError, isFetching, refetch };
}
