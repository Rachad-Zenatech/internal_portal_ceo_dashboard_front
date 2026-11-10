import type { BoardLayoutItem, BoardState, WidgetConfig } from "@/types/customize";

type Seed = Omit<WidgetConfig, "id"> & { pos: Omit<BoardLayoutItem, "i"> };

function build(boardKey: string, seeds: Seed[]): BoardState {
  const widgets: WidgetConfig[] = [];
  const layout: BoardLayoutItem[] = [];
  seeds.forEach(({ pos, ...cfg }, idx) => {
    const id = `${boardKey}-${idx}`;
    widgets.push({ id, ...cfg });
    layout.push({ i: id, ...pos });
  });
  return { widgets, layout };
}

const kpi = (title: string, sourceId: string, aggregation: WidgetConfig["aggregation"], measure: string | undefined, x: number): Seed => ({
  kind: "kpi", title, sourceId, aggregation, measure, pos: { x, y: 0, w: 3, h: 3 },
});

/** "Customization": the Dashboard, rebuilt from live data sources. */
export const DASHBOARD_DEFAULTS: BoardState = build("dash", [
  kpi("Liquid assets", "dashboard_summary", "sum", "assets", 0),
  kpi("Net income", "dashboard_summary", "sum", "netIncome", 3),
  kpi("Pending approvals", "approvals_pending", "count", undefined, 6),
  kpi("LOI accepted deals", "ma_summary", "sum", "loi_accepted_count", 9),
  { kind: "bar", title: "Pending approvals by department", sourceId: "approvals_pending", dimension: "department", measure: "amount", aggregation: "sum", pos: { x: 0, y: 3, w: 6, h: 8 } },
  { kind: "bar", title: "M&A deals by industry", sourceId: "ma_by_industry", dimension: "name", measure: "count", aggregation: "sum", pos: { x: 6, y: 3, w: 6, h: 8 } },
  { kind: "table", title: "Recent audit trail", sourceId: "ceo_audit_logs", columns: ["action", "target_entity", "requested_by", "result", "created_at"], aggregation: "count", pos: { x: 0, y: 11, w: 12, h: 9 } },
]);

/** "Customize - M&A". */
export const MA_DEFAULTS: BoardState = build("ma", [
  kpi("Target companies", "ma_summary", "sum", "total_target_companies", 0),
  kpi("LOI accepted", "ma_summary", "sum", "loi_accepted_count", 3),
  kpi("LOI sent", "ma_summary", "sum", "loi_sent_count", 6),
  kpi("LOI declined", "ma_summary", "sum", "loi_declined_count", 9),
  { kind: "pie", title: "Deals by priority", sourceId: "ma_by_priority", dimension: "name", measure: "count", aggregation: "sum", pos: { x: 0, y: 3, w: 5, h: 8 } },
  { kind: "bar", title: "Deals by industry", sourceId: "ma_by_industry", dimension: "name", measure: "count", aggregation: "sum", pos: { x: 5, y: 3, w: 7, h: 8 } },
  { kind: "table", title: "LOI accepted deals", sourceId: "ma_loi_accepted", columns: ["company_name", "industry_name", "state_name", "revenue", "analyst_name", "latest_note"], aggregation: "count", pos: { x: 0, y: 11, w: 12, h: 10 } },
]);

/** "Customize Administration". */
export const ADMIN_DEFAULTS: BoardState = build("admin", [
  kpi("Pending approvals", "approvals_pending", "count", undefined, 0),
  kpi("Pending amount", "approvals_pending", "sum", "amount", 3),
  kpi("Decisions made", "approvals_history", "count", undefined, 6),
  kpi("Approved amount", "approvals_history", "sum", "amount", 9),
  { kind: "bar", title: "Pending amount by department", sourceId: "approvals_pending", dimension: "department", measure: "amount", aggregation: "sum", pos: { x: 0, y: 3, w: 7, h: 8 } },
  { kind: "pie", title: "History by status", sourceId: "approvals_history", dimension: "status", aggregation: "count", pos: { x: 7, y: 3, w: 5, h: 8 } },
  { kind: "table", title: "Pending approvals", sourceId: "approvals_pending", columns: ["id", "department", "requester_name", "amount", "priority", "status", "created_at"], aggregation: "count", pos: { x: 0, y: 11, w: 12, h: 10 } },
]);
