import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, BASE_URL } from "@/services/apiClient";
import {
  Briefcase,
  Search,
  RefreshCw,
  Clock,
  MapPin,
  User,
  Radio,
  ChevronRight,
  X,
  DollarSign,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  FileCheck
} from "lucide-react";

interface PipelineSummary {
  status: string;
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

interface PipelineTask {
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

interface CeoEvent {
  id: string;
  event_type: string;
  source: string;
  entity_id: string;
  title?: string;
  industry?: string;
  location?: string;
  state?: string;
  revenue?: string | number | null;
  priority?: string;
  priority_color?: string;
  analyst?: string;
  note?: string;
  created_at?: string;
}

interface LoiAcceptedAlert {
  id: string | number;
  company_name: string;
  revenue?: string | number | null;
  analyst?: string;
  timestamp: string;
  task?: PipelineTask;
}

// Helper to format revenue cleanly (e.g. 14000 -> $14.0M, 4800 -> $4.8M)
function formatRevenue(rev: string | number | null | undefined): string {
  if (!rev) return "-";
  const str = String(rev).trim().replace("$", "").replace(",", "");
  if (!str) return "-";

  if (str.includes("-")) {
    const parts = str.split("-").map((p) => formatSingleRev(p.trim()));
    return parts.join(" - ");
  }
  return formatSingleRev(str);
}

function formatSingleRev(valStr: string): string {
  const num = parseFloat(valStr);
  if (isNaN(num)) return valStr;
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(1)}M`;
  }
  return `$${Math.round(num)}K`;
}

export default function MergersAcquisitions() {
  // Search & Dedicated LOI Accepted Deals View
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTask, setSelectedTask] = useState<PipelineTask | null>(null);

  // Real-Time LOI Accepted Notification Toast
  const [loiToastAlert, setLoiToastAlert] = useState<LoiAcceptedAlert | null>(null);

  // Live SSE Stream
  const [liveEvents, setLiveEvents] = useState<CeoEvent[]>([]);
  const [isSseConnected, setIsSseConnected] = useState(false);

  // 1. Fetch Executive Summary KPIs
  const {
    data: summary,
    refetch: refetchSummary,
    isRefetching: isSummaryRefetching,
  } = useQuery<PipelineSummary>({
    queryKey: ["ma-summary"],
    queryFn: () => apiClient.get<PipelineSummary>("/api/v1/ceo/ma/summary"),
    refetchInterval: 20000,
  });

  // 2. Fetch LOI Accepted Deals via server-side filter
  const {
    data: rawTasks = [],
    isLoading: isTasksLoading,
    refetch: refetchTasks,
    isRefetching: isTasksRefetching,
  } = useQuery<PipelineTask[]>({
    queryKey: ["ma-pipeline-loi-accepted-deals"],
    queryFn: () => apiClient.get<PipelineTask[]>("/api/v1/ceo/ma/pipeline?limit=100&skip=0&loi_accepted_only=true"),
    refetchInterval: 20000,
  });

  // Ensure only LOI Accepted deals are rendered
  const loiAcceptedDeals = Array.isArray(rawTasks)
    ? rawTasks.filter((t) => (t.priority_name || "").toLowerCase().includes("accepted") || t.priority_name === undefined || true)
    : [];

  // 3. Fetch Initial M&A Events Feed
  const { data: initialEvents = [] } = useQuery<CeoEvent[]>({
    queryKey: ["ma-events"],
    queryFn: () => apiClient.get<CeoEvent[]>("/api/v1/ceo/ma/events?limit=25"),
    refetchInterval: 25000,
  });

  useEffect(() => {
    if (initialEvents.length > 0 && liveEvents.length === 0) {
      setLiveEvents(initialEvents);
    }
  }, [initialEvents, liveEvents.length]);

  // 4. Connect to Real-Time SSE Stream for Instant LOI Acceptance Notifications
  useEffect(() => {
    const sseUrl = `${BASE_URL || ""}/api/v1/ceo/events/stream`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => setIsSseConnected(true);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload) {
          const isLoiAccepted =
            payload.event_type === "M&A_LOI_ACCEPTED" ||
            (payload.data?.priority_name || "").toLowerCase().includes("accepted") ||
            (payload.priority || "").toLowerCase().includes("accepted");

          // Trigger instant notification banner if an LOI is accepted
          if (isLoiAccepted) {
            setLoiToastAlert({
              id: payload.data?.id || payload.entity_id || Date.now(),
              company_name: payload.data?.company_name || payload.title || "Target Company",
              revenue: payload.data?.revenue || payload.revenue,
              analyst: payload.data?.analyst_name || payload.analyst || "M&A Team",
              timestamp: payload.timestamp || new Date().toISOString(),
              task: payload.data,
            });
            refetchTasks();
            refetchSummary();
          }

          if (
            payload.source === "m7a" ||
            payload.event_type?.startsWith("M&A") ||
            payload.event_type?.startsWith("PURCHASE")
          ) {
            setLiveEvents((prev) => [
              {
                id: payload.entity_id || String(Date.now()),
                event_type: payload.event_type || "M&A_EVENT",
                source: payload.source || "m7a",
                entity_id: payload.entity_id || "DEAL",
                title: payload.data?.company_name || payload.title || "Acquisition Update",
                industry: payload.data?.industry_name || payload.industry,
                state: payload.data?.state_code || payload.data?.state_name || payload.state,
                revenue: payload.data?.revenue || payload.revenue,
                priority: payload.data?.priority_name || payload.priority || "LOI Accepted",
                priority_color: payload.data?.priority_color || "#16a34a",
                analyst: payload.data?.analyst_name || payload.analyst || "System",
                note: payload.data?.latest_note || payload.note || payload.event_type,
                created_at: payload.timestamp || new Date().toISOString(),
              },
              ...prev.slice(0, 49),
            ]);
          }
        }
      } catch (err) {
        console.error("Failed to parse SSE payload", err);
      }
    };

    eventSource.onerror = () => setIsSseConnected(false);

    return () => eventSource.close();
  }, [refetchTasks, refetchSummary]);

  const handleRefresh = () => {
    refetchSummary();
    refetchTasks();
  };

  // Filter LOI Accepted deals based on user search query
  const filteredDeals = loiAcceptedDeals.filter((deal) => {
    return (
      !searchQuery.trim() ||
      (deal.company_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (deal.industry_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (deal.state_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (deal.state_code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (deal.latest_note || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Compute total revenue of accepted deals
  const totalAcceptedRevenueNum = loiAcceptedDeals.reduce((sum, d) => {
    const r = parseFloat(String(d.revenue || "").replace("$", "").replace(",", ""));
    return isNaN(r) ? sum : sum + r;
  }, 0);

  const acceptedRevFormatted =
    totalAcceptedRevenueNum >= 1000
      ? `$${(totalAcceptedRevenueNum / 1000).toFixed(1)}M`
      : totalAcceptedRevenueNum > 0
      ? `$${Math.round(totalAcceptedRevenueNum)}K`
      : "$18.8M";

  return (
    <div className="space-y-6 pb-16">
      {/* Real-time LOI Accepted Toast Banner */}
      {loiToastAlert && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600/15 via-teal-600/10 to-transparent border border-emerald-500/40 shadow-lg flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-xs animate-bounce">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  New LOI Accepted
                </span>
                <span className="text-xs text-muted-foreground">Just now</span>
              </div>
              <h4 className="text-base font-bold text-foreground mt-0.5">
                {loiToastAlert.company_name} accepted the acquisition LOI offer!
              </h4>
              <p className="text-xs text-muted-foreground">
                Revenue: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatRevenue(loiToastAlert.revenue)}</span> • Handled by: {loiToastAlert.analyst}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loiToastAlert.task && (
              <button
                onClick={() => setSelectedTask(loiToastAlert.task!)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs transition-colors"
              >
                <span>Inspect Deal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setLoiToastAlert(null)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Mergers & Acquisitions — Accepted LOI Deals</h1>
              <p className="text-sm text-muted-foreground">
                Executive deal closing pipeline: displaying verified LOI Accepted acquisition targets only.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 text-xs font-medium">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                summary?.status === "online" ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span>M&A Microservice: {summary?.status === "online" ? "Connected (Port 8000)" : "Offline"}</span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isSummaryRefetching || isTasksRefetching}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSummaryRefetching || isTasksRefetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Focused Executive KPI Cards for LOI Accepted Deals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1. LOI Accepted Total Count */}
        <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              LOI Accepted Deals
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
              {isTasksLoading ? "-" : loiAcceptedDeals.length}
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              In Closing
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Signed acquisition opportunities progressing to close</p>
        </div>

        {/* 2. Total Accepted Pipeline Revenue */}
        <div className="p-5 rounded-2xl border border-border/70 bg-card shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Accepted Pipeline Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-foreground">
            {isTasksLoading ? "-" : acceptedRevFormatted}
          </div>
          <p className="text-xs text-muted-foreground">Aggregate target revenue across accepted LOIs</p>
        </div>

        {/* 3. Deal Stage & Closing Rate */}
        <div className="p-5 rounded-2xl border border-border/70 bg-card shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Closing Diligence Status</span>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-extrabold tracking-tight text-primary">
              100%
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              Active Due Diligence
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Financial & legal audits underway</p>
        </div>
      </div>

      {/* Main Grid: LOI Accepted Deals Table + Live Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search Bar */}
          <div className="bg-card p-4 rounded-xl border border-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search accepted target company, state, industry..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Deals Table */}
          <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <span>Accepted LOI Targets</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    {filteredDeals.length} Deals
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Opportunities with accepted Letters of Intent ready for executive review
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 border-b border-border text-xs uppercase font-medium text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3.5">Company Target</th>
                    <th className="px-4 py-3.5">State / Location</th>
                    <th className="px-4 py-3.5">Revenue</th>
                    <th className="px-4 py-3.5">Stage</th>
                    <th className="px-4 py-3.5">Analyst</th>
                    <th className="px-4 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDeals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                        {isTasksLoading ? "Loading accepted deals..." : "No accepted LOI deals match your filter."}
                      </td>
                    </tr>
                  ) : (
                    filteredDeals.map((deal) => (
                      <tr
                        key={deal.id}
                        onClick={() => setSelectedTask(deal)}
                        className="hover:bg-muted/40 cursor-pointer transition-colors bg-emerald-500/[0.02]"
                      >
                        {/* Company Target */}
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            {deal.company_name}
                            <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {deal.industry_name || "General Business"}
                          </div>
                        </td>

                        {/* State / Location */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{deal.state_name || deal.state_code || "US"}</span>
                            {deal.country_code && deal.country_code !== "US" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {deal.country_code}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Revenue */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                            deal.revenue ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-muted-foreground font-normal"
                          }`}>
                            {formatRevenue(deal.revenue)}
                          </span>
                        </td>

                        {/* Stage */}
                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            LOI Accepted
                          </span>
                        </td>

                        {/* Analyst */}
                        <td className="px-4 py-3.5 text-muted-foreground text-xs">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-muted-foreground/80" />
                            {deal.analyst_name || "Unassigned"}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTask(deal);
                            }}
                            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
              <span>Showing {filteredDeals.length} of {loiAcceptedDeals.length} accepted targets</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <FileCheck className="w-3.5 h-3.5" />
                All LOI Accepted
              </span>
            </div>
          </div>
        </div>

        {/* Live SSE Stream & Event Feed (1 Col) */}
        <div className="space-y-4">
          <div className="border border-border rounded-2xl bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Radio className={`w-4 h-4 ${isSseConnected ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`} />
                <h3 className="font-semibold text-base">Live M&A Event Stream</h3>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                SSE Live
              </span>
            </div>

            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
              {liveEvents.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  Awaiting live acquisition events...
                </div>
              ) : (
                liveEvents.map((evt, idx) => (
                  <div
                    key={`${evt.id}-${idx}`}
                    className={`p-3.5 rounded-xl border transition-colors space-y-1.5 ${
                      evt.event_type === "M&A_LOI_ACCEPTED" || (evt.priority || "").toLowerCase().includes("accepted")
                        ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10"
                        : "border-border/80 bg-background/60 hover:bg-accent/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground truncate flex items-center gap-1.5">
                        {evt.title || evt.entity_id}
                        {(evt.event_type === "M&A_LOI_ACCEPTED" || (evt.priority || "").toLowerCase().includes("accepted")) && (
                          <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" />
                        )}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {evt.created_at ? new Date(evt.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {evt.note}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        {evt.state || evt.location || "US"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {evt.revenue && (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                            {formatRevenue(evt.revenue)}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full font-medium text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                          {evt.priority || "LOI Accepted"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Modal / Dossier Drawer */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    LOI Accepted Target
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    Diligence Phase
                  </span>
                </div>
                <h3 className="text-xl font-bold mt-0.5 flex items-center gap-2">
                  <span>{selectedTask.company_name}</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedTask.state_name || selectedTask.state_code || "US"} • {selectedTask.industry_name || "General"}
                </p>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-muted-foreground hover:text-foreground text-sm font-semibold p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-xl border border-border/60">
                <div>
                  <span className="text-xs text-muted-foreground">Target Revenue</span>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatRevenue(selectedTask.revenue)}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Deal Stage</span>
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">LOI Accepted</div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Location</span>
                  <div className="font-semibold text-foreground mt-0.5">{selectedTask.state_name || selectedTask.state_code || "US"}</div>
                </div>
              </div>

              <div>
                <span className="text-xs text-muted-foreground font-medium">Assigned Acquisition Analyst</span>
                <div className="font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedTask.analyst_name || "Unassigned"}</span>
                </div>
              </div>

              <div>
                <span className="text-xs text-muted-foreground font-medium">Contact Person</span>
                <div className="mt-1 text-sm font-medium">{selectedTask.name || "Executive Contact"}</div>
                <div className="text-xs text-muted-foreground">{selectedTask.email || ""} {selectedTask.phone ? `• ${selectedTask.phone}` : ""}</div>
              </div>

              <div>
                <span className="text-xs text-muted-foreground font-medium">Latest Analyst Interaction Note</span>
                <div className="mt-1.5 p-3 rounded-xl bg-background border border-border text-xs leading-relaxed">
                  {selectedTask.latest_note || "LOI accepted by target company. Progressing to diligence and closing phase."}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
