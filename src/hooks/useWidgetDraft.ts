import { useEffect, useMemo, useState } from "react";
import { useDataSource } from "@/hooks/useDataSource";
import { getDataSource } from "@/lib/dataSources";
import { KIND_INFO, defaultsForSource, distinctValues, filterableColumns, measureChoices, suggestTitle } from "@/lib/widgetLogic";
import type { WidgetConfig, WidgetKind } from "@/types/customize";

/** The editing logic behind the "add / edit widget" panel, shared by web and native so they behave the same. */
export function useWidgetDraft(widget: WidgetConfig | null, isNew: boolean) {
  const [draft, setDraft] = useState<WidgetConfig | null>(widget);
  const [titleTouched, setTitleTouched] = useState(false);

  useEffect(() => {
    setDraft(widget);
    const src = widget ? getDataSource(widget.sourceId) : undefined;
    // An existing widget keeps its own name; a new one (or one still on the suggestion) follows the choices.
    setTitleTouched(Boolean(widget && !isNew && widget.title !== suggestTitle(widget, src)));
  }, [widget, isNew]);

  const source = draft ? getDataSource(draft.sourceId) : undefined;
  const { rows: allRows } = useDataSource(draft?.sourceId ?? "");
  const kind: WidgetKind = draft?.kind ?? "table";
  const info = KIND_INFO[kind];

  const measures = useMemo(() => measureChoices(source), [source]);
  const filterCols = useMemo(() => filterableColumns(source), [source]);
  const filterColumn = draft?.filter?.column;
  const filterValues = useMemo(() => (filterColumn ? distinctValues(allRows, filterColumn) : []), [allRows, filterColumn]);

  useEffect(() => {
    if (!draft || titleTouched) return;
    const suggested = suggestTitle(draft, getDataSource(draft.sourceId));
    if (suggested !== draft.title) setDraft((d) => (d ? { ...d, title: suggested } : d));
  }, [draft, titleTouched]);

  const patch = (p: Partial<WidgetConfig>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const setTitle = (title: string) => {
    setTitleTouched(true);
    patch({ title });
  };

  const changeSource = (id: string) => {
    const next = getDataSource(id);
    if (next && draft) patch({ sourceId: id, ...defaultsForSource(next, draft.kind) });
  };

  const changeKind = (k: WidgetKind) => {
    if (!draft) return;
    const hasMeasure = draft.aggregation !== "count" && draft.measure;
    patch({
      kind: k,
      dimension: draft.dimension ?? source?.columns.find((c) => c.role === "dimension" && c.key !== "id")?.key,
      // Keep a "Total of ..." choice when moving between displays that use a value; otherwise count records.
      aggregation: KIND_INFO[k].needsMeasure && hasMeasure ? draft.aggregation : "count",
    });
  };

  const selected = draft?.columns ?? [];
  const labelOf = (key: string) => source?.columns.find((c) => c.key === key)?.label ?? key;
  const moveColumn = (index: number, dir: -1 | 1) => {
    const next = [...selected];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    patch({ columns: next });
  };
  const addColumn = (key: string) => patch({ columns: [...selected, key] });
  const removeColumn = (key: string) => patch({ columns: selected.filter((k) => k !== key) });
  const availableColumns = (search: string) =>
    (source?.columns ?? []).filter((c) => !selected.includes(c.key) && c.label.toLowerCase().includes(search.toLowerCase()));

  const canSave = Boolean(
    draft &&
      draft.title.trim().length > 0 &&
      (kind !== "table" || selected.length > 0) &&
      (!info.needsGroup || draft.dimension) &&
      (kind !== "note" || draft.text?.trim()),
  );

  /** The widget to save: an unfinished "only show…" filter (column but no value) is dropped. */
  const finished = (): WidgetConfig | null => (draft ? (draft.filter && !draft.filter.value ? { ...draft, filter: undefined } : draft) : null);

  return {
    draft, patch, setTitle, source, allRows, kind, info, measures, filterCols, filterValues,
    changeSource, changeKind, selected, labelOf, moveColumn, addColumn, removeColumn, availableColumns, canSave, finished,
  };
}
