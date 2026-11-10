import { DATA_SOURCES } from "@/lib/dataSources";
import type { Aggregation, ColumnType, DataColumn, DataRow, DataSourceDef, WidgetConfig, WidgetKind } from "@/types/customize";

/** Plain-language names and one-line descriptions for every display type (shared by web and native). */
export const KIND_INFO: Record<WidgetKind, { label: string; hint: string; needsGroup: boolean; needsMeasure: boolean }> = {
  table: { label: "Table", hint: "Rows and columns you choose", needsGroup: false, needsMeasure: false },
  kpi: { label: "Number", hint: "One big figure", needsGroup: false, needsMeasure: true },
  bar: { label: "Bars", hint: "Compare groups side by side", needsGroup: true, needsMeasure: true },
  hbar: { label: "Horizontal bars", hint: "Bars with long labels", needsGroup: true, needsMeasure: true },
  line: { label: "Line", hint: "Follow a trend over time", needsGroup: true, needsMeasure: true },
  area: { label: "Area", hint: "A trend with a filled shape", needsGroup: true, needsMeasure: true },
  pie: { label: "Donut", hint: "Share of the whole", needsGroup: true, needsMeasure: true },
  ranking: { label: "Top list", hint: "Biggest items first", needsGroup: true, needsMeasure: true },
  gauge: { label: "Progress", hint: "How close to a goal", needsGroup: false, needsMeasure: true },
  note: { label: "Note", hint: "Your own text", needsGroup: false, needsMeasure: false },
};

export const KIND_ORDER: WidgetKind[] = ["table", "kpi", "bar", "hbar", "line", "area", "pie", "ranking", "gauge", "note"];

export function friendlyType(type: ColumnType): string {
  switch (type) {
    case "currency": return "Amount";
    case "number": return "Number";
    case "date": return "Date";
    case "boolean": return "Yes / No";
    default: return "Text";
  }
}

export interface MeasureChoice {
  value: string;
  label: string;
}

const AGG_WORD: Partial<Record<Aggregation, string>> = { sum: "Total of", avg: "Average of", max: "Highest" };

/** One dropdown instead of two: "Number of records", "Total of Amount", "Average of Amount"... */
export function measureChoices(source: DataSourceDef | undefined): MeasureChoice[] {
  const choices: MeasureChoice[] = [{ value: "count", label: "Number of records" }];
  for (const col of source?.columns ?? []) {
    if (col.type !== "number" && col.type !== "currency") continue;
    for (const agg of ["sum", "avg", "max"] as const) {
      choices.push({ value: `${agg}:${col.key}`, label: `${AGG_WORD[agg]} ${col.label}` });
    }
  }
  return choices;
}

export function encodeMeasure(w: Pick<WidgetConfig, "aggregation" | "measure">): string {
  return w.aggregation === "count" || !w.measure ? "count" : `${w.aggregation}:${w.measure}`;
}

export function decodeMeasure(value: string): { aggregation: Aggregation; measure?: string } {
  if (value === "count") return { aggregation: "count", measure: undefined };
  const [aggregation, measure] = value.split(":");
  return { aggregation: aggregation as Aggregation, measure };
}

function measureSentence(w: WidgetConfig, source: DataSourceDef): string {
  if (w.aggregation === "count" || !w.measure) return "Number of records";
  const col = source.columns.find((c) => c.key === w.measure);
  return `${AGG_WORD[w.aggregation] ?? w.aggregation} ${col?.label ?? w.measure}`;
}

/** A sensible title like "Total of Amount by Department", used until the user types their own. */
export function suggestTitle(w: WidgetConfig, source: DataSourceDef | undefined): string {
  if (!source) return "New widget";
  const group = source.columns.find((c) => c.key === w.dimension)?.label;
  switch (w.kind) {
    case "table": return source.label;
    case "note": return "Note";
    case "kpi":
    case "gauge": return `${measureSentence(w, source)} · ${source.label}`;
    default: return group ? `${measureSentence(w, source)} by ${group}` : source.label;
  }
}

export function defaultsForSource(source: DataSourceDef, kind: WidgetKind): Partial<WidgetConfig> {
  const firstDim = source.columns.find((c) => c.role === "dimension" && c.key !== "id")?.key;
  const firstMeasure = source.columns.find((c) => c.type === "number" || c.type === "currency")?.key;
  const wantsValue = kind === "kpi" || kind === "gauge";
  return {
    dimension: firstDim,
    measure: firstMeasure,
    aggregation: wantsValue && firstMeasure ? "sum" : "count",
    columns: source.columns.slice(0, 6).map((c) => c.key),
    filter: undefined,
  };
}

export function blankWidget(id: string): WidgetConfig {
  const source = DATA_SOURCES[0];
  const base: WidgetConfig = { id, kind: "table", title: "", sourceId: source.id, aggregation: "count" };
  const widget = { ...base, ...defaultsForSource(source, "table") } as WidgetConfig;
  return { ...widget, title: suggestTitle(widget, source) };
}

export function applyFilter(rows: DataRow[], filter: WidgetConfig["filter"]): DataRow[] {
  if (!filter?.column || filter.value === "") return rows;
  return rows.filter((r) => String(r[filter.column] ?? "") === filter.value);
}

/** Distinct values of a column in the loaded rows, most common first, for the "only show..." picker. */
export function distinctValues(rows: DataRow[], key: string, max = 50): string[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = r[key];
    if (v === null || v === undefined || v === "") continue;
    counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([v]) => v);
}

/** Dimensions that make good "only show" filters (text/yes-no, not free text like descriptions). */
export function filterableColumns(source: DataSourceDef | undefined): DataColumn[] {
  return (source?.columns ?? []).filter((c) => (c.type === "string" || c.type === "boolean") && !["description", "latest_note", "id"].includes(c.key));
}

export function firstExample(rows: DataRow[], key: string): string {
  for (const r of rows) {
    const v = r[key];
    if (v !== null && v !== undefined && v !== "") return String(v).slice(0, 28);
  }
  return "";
}
