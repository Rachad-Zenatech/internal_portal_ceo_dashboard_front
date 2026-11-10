export type ColumnType = "string" | "number" | "currency" | "date" | "boolean";

/** dimension = something you group/label by; measure = something you add up or average. */
export type ColumnRole = "dimension" | "measure";

export interface DataColumn {
  key: string;
  label: string;
  type: ColumnType;
  role: ColumnRole;
  description?: string;
}

export type DataSourceModule = "dashboard" | "ma" | "admin" | "system";

export type DataRow = Record<string, unknown>;

export interface DataSourceDef {
  id: string;
  label: string;
  module: DataSourceModule;
  description: string;
  /** Live endpoint on the CEO backend (pass-through: nothing is copied locally). */
  endpoint: string;
  /** First React Query key segment, so realtime events that invalidate this namespace refresh the source. */
  queryNamespace: string;
  columns: DataColumn[];
  /** Turns the raw API response into flat rows. */
  toRows: (raw: unknown) => DataRow[];
}

export type WidgetKind = "table" | "kpi" | "bar" | "hbar" | "line" | "area" | "pie" | "ranking" | "gauge" | "note";
export type Aggregation = "count" | "sum" | "avg" | "min" | "max";

export interface WidgetConfig {
  id: string;
  kind: WidgetKind;
  title: string;
  sourceId: string;
  /** Group-by column (charts). */
  dimension?: string;
  /** Value column (charts, KPI). Ignored when aggregation is "count". */
  measure?: string;
  aggregation: Aggregation;
  /** Visible columns, in order (tables). */
  columns?: string[];
  /** Max categories (charts) or rows per page (tables). */
  limit?: number;
  /** Only use rows where `column` equals `value`. */
  filter?: { column: string; value: string };
  /** Goal for a gauge. */
  target?: number;
  /** Free text for a note. */
  text?: string;
}

export interface BoardLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardState {
  widgets: WidgetConfig[];
  layout: BoardLayoutItem[];
}
