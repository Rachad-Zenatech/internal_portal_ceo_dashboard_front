import type { DataColumn, DataRow, DataSourceDef } from "@/types/customize";

// Live pass-through catalog. Each source maps to an existing CEO-backend endpoint; the dashboard never
// stores a copy. Column lists mirror the fields the pages already read from those endpoints.

const asRows = (raw: unknown): DataRow[] => (Array.isArray(raw) ? (raw as DataRow[]) : []);
const asSingleRow = (raw: unknown): DataRow[] => (raw && typeof raw === "object" ? [raw as DataRow] : []);

/** M&A revenue is a range string in $K ("500-1000"); use the midpoint so it can be summed/averaged. */
function revenueMidpointK(rev: unknown): number | null {
  if (rev === null || rev === undefined || rev === "") return null;
  const nums = String(rev)
    .replace(/[$,]/g, "")
    .split("-")
    .map((p) => parseFloat(p.trim()))
    .filter((n) => !Number.isNaN(n));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

const withRevenueK = (raw: unknown): DataRow[] =>
  asRows(raw).map((r) => ({ ...r, revenue_k: revenueMidpointK(r.revenue) }));

const dim = (key: string, label: string, description?: string): DataColumn => ({ key, label, type: "string", role: "dimension", description });
const date = (key: string, label: string): DataColumn => ({ key, label, type: "date", role: "dimension" });
const bool = (key: string, label: string): DataColumn => ({ key, label, type: "boolean", role: "dimension" });
const num = (key: string, label: string, description?: string): DataColumn => ({ key, label, type: "number", role: "measure", description });
const money = (key: string, label: string, description?: string): DataColumn => ({ key, label, type: "currency", role: "measure", description });

const APPROVAL_COLUMNS: DataColumn[] = [
  dim("id", "Request ID"),
  dim("department", "Department"),
  dim("status", "Status"),
  dim("priority", "Priority"),
  dim("request_type", "Request type"),
  dim("requester_name", "Requester"),
  dim("assigned_user", "Assigned to"),
  dim("description", "Description"),
  dim("product_name", "Product"),
  dim("vendor", "Vendor"),
  dim("payment_method", "Payment method"),
  dim("gl_code", "GL code"),
  dim("currency", "Currency"),
  money("amount", "Amount (USD)"),
  money("amount_after_tax", "Amount after tax"),
  money("unit_price", "Unit price"),
  num("quantity", "Quantity"),
  num("tax_rate", "Tax rate"),
  dim("level_1_approver_name", "Level 1 approver"),
  dim("level_2_approver_name", "Level 2 approver"),
  bool("requires_second_level", "Needs 2nd level"),
  date("created_at", "Created"),
  date("request_date", "Request date"),
  date("approved_at", "Approved at"),
];

const PIPELINE_COLUMNS: DataColumn[] = [
  dim("company_name", "Target company"),
  dim("industry_name", "Industry"),
  dim("state_name", "State"),
  dim("state_code", "State code"),
  dim("country_name", "Country"),
  dim("priority_name", "Priority"),
  dim("analyst_name", "Lead analyst"),
  dim("analyst_email", "Analyst email"),
  dim("name", "Contact name"),
  dim("email", "Contact email"),
  dim("phone", "Contact phone"),
  dim("nda", "NDA status"),
  dim("p_and_l", "P&L status"),
  dim("first_poc", "First contact"),
  dim("latest_note", "Latest note"),
  dim("revenue", "Revenue (range, $K)", "Original range text from the M&A service"),
  money("revenue_k", "Revenue ($K, midpoint)", "Midpoint of the revenue range, so it can be summed"),
  num("team_size", "Team size"),
  num("no_of_calls", "Number of calls"),
  num("id", "Deal ID"),
  date("created_at", "Created"),
  date("updated_at", "Last updated"),
];

/** Turn a { label: count } map from the summary into rows. */
const breakdownRows = (raw: unknown, key: "tasks_by_industry" | "tasks_by_priority"): DataRow[] => {
  const map = (raw as Record<string, Record<string, number>> | null)?.[key] ?? {};
  return Object.entries(map).map(([name, count]) => ({ name, count: Number(count) || 0 }));
};

export const DATA_SOURCES: DataSourceDef[] = [
  {
    id: "dashboard_summary",
    label: "Financial summary",
    module: "dashboard",
    description: "One row of headline balance-sheet and income figures.",
    endpoint: "/api/dashboard/summary",
    queryNamespace: "summaryMetrics",
    columns: [money("assets", "Assets"), money("liabilities", "Liabilities"), money("equity", "Equity"), money("netIncome", "Net income")],
    toRows: asSingleRow,
  },
  {
    id: "approvals_pending",
    label: "Pending approvals",
    module: "admin",
    description: "Purchase requests waiting for executive sign-off (live from Administration).",
    endpoint: "/api/v1/ceo/approvals/pending",
    queryNamespace: "admin",
    columns: APPROVAL_COLUMNS,
    toRows: asRows,
  },
  {
    id: "approvals_history",
    label: "Approval history",
    module: "admin",
    description: "Completed approval decisions, including ones waiting to sync back.",
    endpoint: "/api/v1/ceo/approvals/history",
    queryNamespace: "admin",
    columns: [...APPROVAL_COLUMNS, bool("pending_sync", "Waiting reconnect")],
    toRows: asRows,
  },
  {
    id: "ma_pipeline",
    label: "M&A pipeline (all deals)",
    module: "ma",
    description: "Every acquisition target in the pipeline (latest 200).",
    endpoint: "/api/v1/ceo/ma/pipeline?limit=200&skip=0",
    queryNamespace: "ma",
    columns: PIPELINE_COLUMNS,
    toRows: withRevenueK,
  },
  {
    id: "ma_loi_accepted",
    label: "M&A LOI-accepted deals",
    module: "ma",
    description: "Targets whose letter of intent was accepted (latest 200).",
    endpoint: "/api/v1/ceo/ma/pipeline?limit=200&skip=0&loi_accepted_only=true",
    queryNamespace: "ma",
    columns: PIPELINE_COLUMNS,
    toRows: withRevenueK,
  },
  {
    id: "ma_summary",
    label: "M&A summary",
    module: "ma",
    description: "One row of pipeline totals and LOI counts.",
    endpoint: "/api/v1/ceo/ma/summary",
    queryNamespace: "ma",
    columns: [
      num("total_active_pipeline_tasks", "Active pipeline tasks"),
      num("total_target_companies", "Target companies"),
      num("total_call_interactions", "Call interactions"),
      num("loi_sent_count", "LOI sent"),
      num("loi_accepted_count", "LOI accepted"),
      num("loi_declined_count", "LOI declined"),
      num("total_loi_active_count", "LOI active"),
    ],
    toRows: asSingleRow,
  },
  {
    id: "ma_by_industry",
    label: "M&A deals by industry",
    module: "ma",
    description: "Deal counts grouped by industry, from the M&A summary.",
    endpoint: "/api/v1/ceo/ma/summary",
    queryNamespace: "ma",
    columns: [dim("name", "Industry"), num("count", "Deals")],
    toRows: (raw) => breakdownRows(raw, "tasks_by_industry"),
  },
  {
    id: "ma_by_priority",
    label: "M&A deals by priority",
    module: "ma",
    description: "Deal counts grouped by priority, from the M&A summary.",
    endpoint: "/api/v1/ceo/ma/summary",
    queryNamespace: "ma",
    columns: [dim("name", "Priority"), num("count", "Deals")],
    toRows: (raw) => breakdownRows(raw, "tasks_by_priority"),
  },
  {
    id: "ceo_audit_logs",
    label: "Audit log",
    module: "system",
    description: "Cross-portal actions recorded by the CEO dashboard (latest 200).",
    endpoint: "/api/v1/ceo/audit-logs?limit=200",
    queryNamespace: "ceoAuditLogs",
    columns: [
      dim("action", "Action"),
      dim("target_entity", "Target"),
      dim("requested_by", "Requested by"),
      dim("source_application", "Source app"),
      dim("target_application", "Target app"),
      dim("result", "Result"),
      date("created_at", "Time"),
    ],
    toRows: asRows,
  },
  {
    id: "ceo_events",
    label: "Event feed",
    module: "system",
    description: "Business events received from connected portals (latest 200).",
    endpoint: "/api/v1/ceo/events?limit=200",
    queryNamespace: "ceoEvents",
    columns: [dim("event_type", "Event type"), dim("source", "Source"), dim("entity_id", "Entity"), date("created_at", "Time")],
    toRows: asRows,
  },
];

export const MODULE_LABELS: Record<string, string> = {
  dashboard: "Finance",
  admin: "Administration",
  ma: "Mergers & Acquisitions",
  system: "System",
};

export function getDataSource(id: string): DataSourceDef | undefined {
  return DATA_SOURCES.find((s) => s.id === id);
}
