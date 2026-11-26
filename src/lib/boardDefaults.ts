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

/** Centralized Executive Dashboard defaults spanning Finance, Admin, M&A, Compliance, and Real Estate. */
export const DASHBOARD_DEFAULTS: BoardState = build("dash", [
  kpi("Liquid assets", "dashboard_summary", "sum", "assets", 0),
  kpi("Pending approvals", "approvals_pending", "count", undefined, 3),
  kpi("LOI accepted deals", "ma_summary", "sum", "loi_accepted_count", 6),
  kpi("Real Estate properties", "real_estate_properties", "count", undefined, 9),
  { kind: "bar", title: "Pending approvals by department", sourceId: "approvals_pending", dimension: "department", measure: "amount", aggregation: "sum", pos: { x: 0, y: 3, w: 6, h: 8 } },
  { kind: "bar", title: "M&A deals by industry", sourceId: "ma_by_industry", dimension: "name", measure: "count", aggregation: "sum", pos: { x: 6, y: 3, w: 6, h: 8 } },
  { kind: "pie", title: "Approved content by brand", sourceId: "compliance_approved_content", dimension: "brand_name", aggregation: "count", pos: { x: 0, y: 11, w: 5, h: 8 } },
  { kind: "bar", title: "Real Estate properties by city", sourceId: "real_estate_by_city", dimension: "city", measure: "count", aggregation: "sum", pos: { x: 5, y: 11, w: 7, h: 8 } },
  { kind: "table", title: "Real Estate portfolio", sourceId: "real_estate_properties", columns: ["property_name", "city", "country_code", "property_type", "bedrooms", "unit_area", "record_status"], aggregation: "count", pos: { x: 0, y: 19, w: 12, h: 8 } },
]);

/** "Customize - Finance". */
export const FINANCE_DEFAULTS: BoardState = build("finance", [
  kpi("Liquid assets", "dashboard_summary", "sum", "assets", 0),
  kpi("Net income", "dashboard_summary", "sum", "netIncome", 3),
  kpi("Total liabilities", "dashboard_summary", "sum", "liabilities", 6),
  kpi("Total equity", "dashboard_summary", "sum", "equity", 9),
  { kind: "bar", title: "Pending spend by department", sourceId: "approvals_pending", dimension: "department", measure: "amount", aggregation: "sum", pos: { x: 0, y: 3, w: 6, h: 8 } },
  { kind: "bar", title: "Approved spend by department", sourceId: "approvals_history", dimension: "department", measure: "amount", aggregation: "sum", pos: { x: 6, y: 3, w: 6, h: 8 } },
  { kind: "table", title: "Pending purchase requests", sourceId: "approvals_pending", columns: ["id", "department", "vendor", "amount", "priority", "status"], aggregation: "count", pos: { x: 0, y: 11, w: 12, h: 9 } },
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

/** "Customize - Social Compliance". */
export const COMPLIANCE_DEFAULTS: BoardState = build("compliance", [
  kpi("Approved posts", "compliance_approved_content", "count", undefined, 0),
  kpi("Avg compliance score", "compliance_approved_content", "avg", "latest_score", 3),
  kpi("Mood topics tracked", "compliance_public_mood", "count", undefined, 6),
  kpi("Total mood mentions", "compliance_public_mood", "sum", "volume", 9),
  { kind: "pie", title: "Approved content by brand", sourceId: "compliance_approved_content", dimension: "brand_name", aggregation: "count", pos: { x: 0, y: 3, w: 5, h: 8 } },
  { kind: "bar", title: "Public mood volume by topic", sourceId: "compliance_public_mood", dimension: "name", measure: "volume", aggregation: "sum", pos: { x: 5, y: 3, w: 7, h: 8 } },
  { kind: "table", title: "Approved social content", sourceId: "compliance_approved_content", columns: ["reference_code", "title", "brand_name", "content_type", "latest_score", "created_by_name"], aggregation: "count", pos: { x: 0, y: 11, w: 12, h: 10 } },
]);

/** "Customize - Real Estate". */
export const REAL_ESTATE_DEFAULTS: BoardState = build("real_estate", [
  kpi("Total properties", "real_estate_properties", "count", undefined, 0),
  kpi("Total bedrooms", "real_estate_properties", "sum", "bedrooms", 3),
  kpi("Total unit area", "real_estate_properties", "sum", "unit_area", 6),
  kpi("Cities covered", "real_estate_by_city", "count", undefined, 9),
  { kind: "bar", title: "Properties by city", sourceId: "real_estate_by_city", dimension: "city", measure: "count", aggregation: "sum", pos: { x: 0, y: 3, w: 7, h: 8 } },
  { kind: "pie", title: "Properties by status", sourceId: "real_estate_properties", dimension: "record_status", aggregation: "count", pos: { x: 7, y: 3, w: 5, h: 8 } },
  { kind: "table", title: "Real Estate portfolio", sourceId: "real_estate_properties", columns: ["property_name", "city", "state_province_region", "country_code", "property_type", "bedrooms", "unit_area", "record_status"], aggregation: "count", pos: { x: 0, y: 11, w: 12, h: 10 } },
]);
