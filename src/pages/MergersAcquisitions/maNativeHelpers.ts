export interface PipelineSummary {
  status: string;
  data_source?: "live" | "saved";
  as_of?: string | null;
  total_active_pipeline_tasks: number;
  total_target_companies: number;
  total_call_interactions: number;
  total_pipeline_revenue?: string;
  loi_sent_count?: number;
  loi_accepted_count?: number;
  loi_declined_count?: number;
  total_loi_active_count?: number;
  tasks_by_priority: Record<string, number>;
  tasks_by_industry: Record<string, number>;
  recent_tasks: PipelineTask[];
}

export interface PipelineTask {
  id: number;
  company_name: string;
  industry_name?: string;
  state_code?: string;
  state_name?: string;
  country_code?: string;
  country_name?: string;
  revenue?: string | number | null;
  name?: string;
  email?: string;
  phone?: string;
  priority_name?: string;
  priority_color?: string;
  analyst_name?: string;
  latest_note?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CeoEvent {
  id: string;
  event_type: string;
  source: string;
  entity_id: string;
  title?: string;
  industry?: string;
  state?: string;
  revenue?: string | number | null;
  priority?: string;
  priority_color?: string;
  analyst?: string;
  note?: string;
  created_at?: string;
}

export function formatSingleRev(valStr: string): string {
  const num = parseFloat(valStr);
  if (isNaN(num)) return valStr;
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(1)}M`;
  }
  return `$${Math.round(num)}K`;
}

export function formatRevenue(rev: string | number | null | undefined): string {
  if (!rev) return "-";
  const str = String(rev).trim().replace("$", "").replace(",", "");
  if (!str) return "-";

  if (str.includes("-")) {
    const parts = str.split("-").map((p) => formatSingleRev(p.trim()));
    return parts.join(" - ");
  }
  return formatSingleRev(str);
}
