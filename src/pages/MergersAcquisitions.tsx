import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { useCeoRealtimeStream } from "@/hooks/useCeoRealtimeStream";
import { useServiceStatus } from "@/lib/ServiceStatusContext";
import {
  Briefcase,
  Search,
  RefreshCw,
  CheckCircle2,
  WifiOff,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WidgetErrorBoundary } from "@/components/WidgetErrorBoundary";
import { toast } from "sonner";

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
  const [searchQuery, setSearchQuery] = useState("");

  // Shared Singleton SSE Hook & Event-Driven Service Availability
  const { lastSyncedAt, triggerManualSync } = useCeoRealtimeStream();
  const { isOnline } = useServiceStatus();
  const isMaOnline = isOnline("ma");

  // 1. Fetch Executive Summary KPIs
  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
    isFetching: isSummaryFetching,
    isError: isSummaryError,
  } = useQuery<PipelineSummary>({
    queryKey: ["ma", "summary"],
    queryFn: ({ signal }) => apiClient.get<PipelineSummary>("/api/v1/ceo/ma/summary", { signal }),
    staleTime: 60000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // 2. Fetch LOI Accepted Deals via server-side filter
  const {
    data: rawTasks = [],
    isLoading: isTasksLoading,
    refetch: refetchTasks,
    isFetching: isTasksFetching,
    isError: isTasksError,
  } = useQuery<PipelineTask[]>({
    queryKey: ["ma", "pipeline-loi-accepted-deals"],
    queryFn: ({ signal }) => apiClient.get<PipelineTask[]>("/api/v1/ceo/ma/pipeline?limit=100&skip=0&loi_accepted_only=true", { signal }),
    staleTime: 60000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const isMaOffline = !isMaOnline || summary?.status === "offline" || isSummaryError || isTasksError;
  const isRefreshingAny = isSummaryFetching || isTasksFetching;

  const refreshAll = () => {
    triggerManualSync();
    refetchSummary();
    refetchTasks();
    toast.info("Retrying M&A connection and refreshing pipeline feeds...");
  };

  const loiAcceptedDeals = useMemo(() => {
    return Array.isArray(rawTasks) ? rawTasks : [];
  }, [rawTasks]);

  const filteredDeals = useMemo(() => {
    return loiAcceptedDeals.filter((t) => {
      const q = searchQuery.toLowerCase();
      return (
        (t.company_name || "").toLowerCase().includes(q) ||
        (t.industry_name || "").toLowerCase().includes(q) ||
        (t.analyst_name || "").toLowerCase().includes(q) ||
        (t.state_name || "").toLowerCase().includes(q)
      );
    });
  }, [loiAcceptedDeals, searchQuery]);

  return (
    <div className="w-full flex flex-col gap-4 sm:gap-5 p-4 sm:p-6 lg:p-7 min-h-screen bg-slate-50/40 dark:bg-zinc-950 transition-colors">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100 flex items-center gap-2.5">
              <Briefcase className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Mergers & Acquisitions Pipeline
            </h1>
            <span
              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                !isMaOffline
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${!isMaOffline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              {!isMaOffline ? "M&A Service Online (:8000)" : "M&A Service Offline (:8000)"}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Real-time acquisition target pipeline, LOI accepted tracker, and synchronized cross-service deal telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={refreshAll}
            disabled={isRefreshingAny}
            className="text-xs h-9 px-3.5 rounded-xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 gap-1.5 shadow-2xs cursor-pointer"
            title={`Last synced: ${lastSyncedAt.toLocaleTimeString()}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAny ? "animate-spin text-indigo-600" : ""}`} />
            <span className="hidden sm:inline">Sync Pipeline</span>
          </Button>
        </div>
      </div>

      {/* Disconnected Notice Banner with Retry Connection Button */}
      {isMaOffline && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 shadow-2xs transition-all">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0">
              <WifiOff className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <span>M&A Microservice Disconnected</span>
                <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-amber-200/70 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 uppercase">
                  Offline
                </span>
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                The connection to the M&A Microservice (:8000) is currently unreachable. Displaying cached pipeline data while disconnected. Navigation and actions remain fully active.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={refreshAll}
            disabled={isRefreshingAny}
            className="h-8 px-4 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-2xs gap-1.5 shrink-0 cursor-pointer active:scale-98"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAny ? "animate-spin" : ""}`} />
            <span>Retry Connection</span>
          </Button>
        </div>
      )}

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Pipeline Target Companies */}
        <WidgetErrorBoundary widgetName="Total Target Companies">
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <CardContent className="p-4 sm:p-5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                Target Companies
              </span>
              <div className="mt-2.5">
                {isSummaryLoading && !isMaOffline ? (
                  <div className="space-y-1.5 py-0.5">
                    <Skeleton className="h-7 w-20 rounded-lg" />
                    <Skeleton className="h-3.5 w-28 rounded" />
                  </div>
                ) : (
                  <>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100">
                      {summary?.total_target_companies || summary?.total_active_pipeline_tasks || 0}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Active prospective targets</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>

        {/* LOI Accepted Deals */}
        <WidgetErrorBoundary widgetName="LOI Accepted Deals">
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <CardContent className="p-4 sm:p-5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                LOI Accepted
              </span>
              <div className="mt-2.5">
                {isSummaryLoading && !isMaOffline ? (
                  <div className="space-y-1.5 py-0.5">
                    <Skeleton className="h-7 w-20 rounded-lg" />
                    <Skeleton className="h-3.5 w-32 rounded" />
                  </div>
                ) : (
                  <>
                    <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {summary?.loi_accepted_count || loiAcceptedDeals.length || 0}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Ready for due diligence</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>

        {/* LOI In-Flight (Sent) */}
        <WidgetErrorBoundary widgetName="LOI Sent In-Flight">
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <CardContent className="p-4 sm:p-5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                LOI Sent / Pending
              </span>
              <div className="mt-2.5">
                {isSummaryLoading && !isMaOffline ? (
                  <div className="space-y-1.5 py-0.5">
                    <Skeleton className="h-7 w-20 rounded-lg" />
                    <Skeleton className="h-3.5 w-28 rounded" />
                  </div>
                ) : (
                  <>
                    <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
                      {summary?.loi_sent_count || 0}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Pending target response</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>

        {/* Estimated Pipeline Revenue */}
        <WidgetErrorBoundary widgetName="Pipeline Revenue">
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <CardContent className="p-4 sm:p-5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">
                Target Revenue Pool
              </span>
              <div className="mt-2.5">
                {isSummaryLoading && !isMaOffline ? (
                  <div className="space-y-1.5 py-0.5">
                    <Skeleton className="h-7 w-24 rounded-lg" />
                    <Skeleton className="h-3.5 w-32 rounded" />
                  </div>
                ) : (
                  <>
                    <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                      {summary?.total_pipeline_revenue || "$0"}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Aggregate annual run-rate</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>
      </div>

      {/* Main Deals List & Detail Section */}
      <WidgetErrorBoundary widgetName="LOI Accepted Target List" onReset={refetchTasks}>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                LOI Accepted Acquisition Deals
              </h3>
              <Badge variant="outline" className="text-[10px] px-2 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold">
                {filteredDeals.length} Deals
              </Badge>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={"Search target company, industry..."}

                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`h-8 pl-8 text-xs bg-slate-50/60 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700 rounded-lg w-full ${
                  isMaOffline ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-zinc-900" : ""
                }`}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs overflow-hidden">
            {isTasksLoading && !isMaOffline ? (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-zinc-800/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold">
                      <th className="py-3 px-4 w-[200px]">Target Company</th>
                      <th className="py-3 px-4 w-[160px]">Industry</th>
                      <th className="py-3 px-4 w-[130px]">Location</th>
                      <th className="py-3 px-4 w-[140px] text-right">Revenue</th>
                      <th className="py-3 px-4 w-[160px] text-center">Status</th>
                      <th className="py-3 px-4 min-w-[200px]">Latest Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <tr key={i} className="hover:bg-slate-50/40 dark:hover:bg-zinc-800/30">
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-32 rounded" /></td>
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-24 rounded" /></td>
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-20 rounded" /></td>
                        <td className="py-3.5 px-4 text-right"><Skeleton className="h-4 w-16 ml-auto rounded" /></td>
                        <td className="py-3.5 px-4 text-center"><Skeleton className="h-5 w-24 mx-auto rounded-full" /></td>
                        <td className="py-3.5 px-4"><Skeleton className="h-4 w-48 rounded" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : filteredDeals.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  No LOI Accepted Deals
                </h4>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  No accepted LOI records are currently registered in the pipeline.
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-zinc-800/60 border-b border-slate-200/80 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-semibold">
                      <th className="py-3 px-4 w-[200px] whitespace-nowrap">Target Company</th>
                      <th className="py-3 px-4 w-[160px] whitespace-nowrap">Industry</th>
                      <th className="py-3 px-4 w-[130px] whitespace-nowrap">Location</th>
                      <th className="py-3 px-4 w-[140px] text-right whitespace-nowrap">Revenue</th>
                      <th className="py-3 px-4 w-[160px] text-center whitespace-nowrap">Status</th>
                      <th className="py-3 px-4 min-w-[200px]">Latest Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {filteredDeals.map((deal) => (
                      <tr
                        key={deal.id}

                        className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors group"
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors whitespace-nowrap">
                          {deal.company_name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300 whitespace-nowrap">
                          {deal.industry_name || "General"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                          {deal.state_name || deal.state_code || deal.country_name || "United States"}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-zinc-100 whitespace-nowrap">
                          {formatRevenue(deal.revenue)}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 uppercase">
                            LOI Accepted
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300 line-clamp-1">
                          {deal.latest_note || "LOI formally accepted by target management."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </WidgetErrorBoundary>
    </div>
  );
}
