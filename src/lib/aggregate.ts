import type { Aggregation, ColumnType, DataColumn, DataRow } from "@/types/customize";

export interface ChartPoint {
  name: string;
  value: number;
}

const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export function aggregate(rows: DataRow[], measure: string | undefined, agg: Aggregation): number {
  if (agg === "count" || !measure) return rows.length;
  const nums = rows.map((r) => toNumber(r[measure])).filter((n): n is number => n !== null);
  if (nums.length === 0) return 0;
  switch (agg) {
    case "sum": return nums.reduce((a, b) => a + b, 0);
    case "avg": return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "min": return Math.min(...nums);
    case "max": return Math.max(...nums);
  }
}

/** Group rows by a column and aggregate a measure. Dates group by month and sort chronologically. */
export function groupRows(
  rows: DataRow[],
  dimension: DataColumn | undefined,
  measure: string | undefined,
  agg: Aggregation,
  limit = 12,
): ChartPoint[] {
  if (!dimension) return [];
  const groups = new Map<string, DataRow[]>();
  for (const row of rows) {
    const raw = row[dimension.key];
    let label = raw === null || raw === undefined || raw === "" ? "(blank)" : String(raw);
    if (dimension.type === "date" && label !== "(blank)") label = label.slice(0, 7); // YYYY-MM
    if (dimension.type === "boolean" && label !== "(blank)") label = label === "true" ? "Yes" : "No";
    const bucket = groups.get(label);
    if (bucket) bucket.push(row);
    else groups.set(label, [row]);
  }
  const points = [...groups.entries()].map(([name, rs]) => ({ name, value: aggregate(rs, measure, agg) }));
  if (dimension.type === "date") {
    // Chronological, with undated records last (and dropped first if the limit trims).
    const dated = points.filter((p) => p.name !== "(blank)").sort((a, b) => a.name.localeCompare(b.name));
    const blank = points.filter((p) => p.name === "(blank)");
    return [...dated.slice(-(limit - blank.length)), ...blank];
  }
  return points.sort((a, b) => b.value - a.value).slice(0, limit);
}

export function formatValue(value: unknown, type: ColumnType): string {
  if (value === null || value === undefined || value === "") return "-";
  switch (type) {
    case "currency": {
      const n = toNumber(value);
      return n === null ? String(value) : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
    case "number": {
      const n = toNumber(value);
      return n === null ? String(value) : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    case "date": {
      const text = String(value);
      // Date-only values are calendar dates, not UTC instants: build them in local time to avoid an off-by-one day.
      const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
      const d = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(text);
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(undefined, { dateStyle: "medium" });
    }
    case "boolean":
      return value === true || value === "true" ? "Yes" : "No";
    default:
      return String(value);
  }
}

/** Compact number for KPI tiles / axes (1.2K, 3.4M). */
export function formatCompact(n: number, currency = false): string {
  const s = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
  return currency ? `$${s}` : s;
}
