import { useState, useMemo, useEffect, useRef } from "react";
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
  Building2,
  User,
  FileText,
  Target,
  Send,
  DollarSign,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WidgetErrorBoundary } from "@/components/common/WidgetErrorBoundary";
import { KpiCard } from "@/components/Dashboard/KpiCard";
import { toast } from "sonner";

// The deal list loads this many rows at a time as you scroll.
const BATCH_SIZE = 10;

interface PipelineSummary {
  status: string;
  /** "saved" means the backend could not reach the M&A service and is showing its stored copy. */
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
  analyst_email?: string;
  latest_note?: string;
  created_at?: string;
  updated_at?: string;
  /** Set by the backend on rows served from its saved copy because the live M&A call failed. */
  _stale?: boolean;
  nda?: string;
  p_and_l?: string;
  team_size?: string;
  first_poc?: string;
  no_of_calls?: string;
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
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [selectedDeal, setSelectedDeal] = useState<PipelineTask | null>(null);

  const { lastSyncedAt, triggerManualSync } = useCeoRealtimeStream();
  const { isOnline } = useServiceStatus();
  const isMaOnline = isOnline("ma");

  // 1. Executive summary KPIs. Kept fresh by WebSocket invalidation of ["ma"], plus refetch on focus.
  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
    isFetching: isSummaryFetching,
    isError: isSummaryError,
  } = useQuery<PipelineSummary>({
    queryKey: ["ma", "summary"],
    queryFn: ({ signal }) => apiClient.get<PipelineSummary>("/api/v1/ceo/ma/summary", { signal }),
    staleTime: 30000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  // 2. LOI accepted deals via server-side filter
  const {
    data: rawTasks = [],
    isLoading: isTasksLoading,
    refetch: refetchTasks,
    isFetching: isTasksFetching,
    isError: isTasksError,
  } = useQuery<PipelineTask[]>({
    queryKey: ["ma", "pipeline-loi-accepted-deals"],
    queryFn: ({ signal }) => apiClient.get<PipelineTask[]>("/api/v1/ceo/ma/pipeline?limit=100&skip=0&loi_accepted_only=true", { signal }),
    staleTime: 30000,
    retry: false,
    refetchOnWindowFocus: true,
  });

  // "Saved" is judged from both responses: the KPI summary and the deal rows each say whether they are live.
  const dealsAreSaved = Array.isArray(rawTasks) && rawTasks.some((d) => d._stale);
  const showingSaved = summary?.data_source === "saved" || dealsAreSaved;
  const isMaOffline = !isMaOnline || summary?.status === "offline" || dealsAreSaved || isSummaryError || isTasksError;
  const isRefreshingAny = isSummaryFetching || isTasksFetching;

  const refreshAll = () => {
    triggerManualSync();
    refetchSummary();
    refetchTasks();
    toast.info("Refreshing M&A pipeline...");
  };

  const loiAcceptedDeals = useMemo(() => (Array.isArray(rawTasks) ? rawTasks : []), [rawTasks]);

  const filteredDeals = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return loiAcceptedDeals.filter(
      (t) =>
        (t.company_name || "").toLowerCase().includes(q) ||
        (t.industry_name || "").toLowerCase().includes(q) ||
        (t.analyst_name || "").toLowerCase().includes(q) ||
        (t.state_name || "").toLowerCase().includes(q),
    );
  }, [loiAcceptedDeals, searchQuery]);

  // A new search starts again from the first 10 matches.
  useEffect(() => setVisibleCount(BATCH_SIZE), [searchQuery]);

  const visibleDeals = filteredDeals.slice(0, visibleCount);
  const hasMore = visibleCount < filteredDeals.length;
  const loadMore = () => setVisibleCount((c) => c + BATCH_SIZE);

  // Infinite scroll: when the marker at the bottom of the list scrolls into view, reveal the next 10. The effect
  // re-runs after each batch, so a tall screen keeps filling until the list overflows.
  useEffect(() => {
    const root = scrollRef.current;
    const marker = sentinelRef.current;
    if (!root || !marker || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisibleCount((c) => c + BATCH_SIZE);
      },
      { root, rootMargin: "120px" },
    );
    observer.observe(marker);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);
  const showSkeleton = isTasksLoading && !isMaOffline;
  const kpiLoading = isSummaryLoading && !isMaOffline;

  return (
    <div className="mx-auto w-full max-w-[1600px] flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 lg:p-8 min-h-screen bg-background">
      {/* Page header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">M&A Pipeline</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${isMaOffline ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`} />
              {isMaOffline ? "Offline" : "Live"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Acquisition targets and LOI-accepted deals, synced from the M&A service.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshAll}
          disabled={isRefreshingAny}
          className="h-10 sm:h-9 rounded-xl gap-2 self-start sm:self-auto cursor-pointer"
          title={`Last synced: ${lastSyncedAt.toLocaleTimeString()}`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingAny ? "animate-spin" : ""}`} />
          <span>Refresh</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </Button>
      </header>

      {isMaOffline && (
        <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-amber-900 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <WifiOff className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{showingSaved ? "Showing saved M&A data, not live" : "M&A service unreachable"}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                {showingSaved
                  ? `The M&A service did not answer the live request${summary?.as_of ? `, so this is the copy saved on ${new Date(summary.as_of).toLocaleString()}` : ""}. It refreshes automatically once the connection works.`
                  : "Showing the last loaded data. It will refresh automatically when the service returns."}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={refreshAll} disabled={isRefreshingAny} className="h-10 sm:h-9 rounded-xl bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shrink-0 cursor-pointer">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingAny ? "animate-spin" : ""}`} />
            Retry
          </Button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <WidgetErrorBoundary widgetName="Total Target Companies">
          <KpiCard label="Target companies" tone="indigo" icon={<Target className="h-4 w-4" />} loading={kpiLoading}
            value={summary?.total_target_companies ?? summary?.total_active_pipeline_tasks ?? 0} hint="Active prospects" />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary widgetName="LOI Accepted Deals">
          <KpiCard label="LOI accepted" tone="emerald" icon={<CheckCircle2 className="h-4 w-4" />} loading={kpiLoading}
            value={summary?.loi_accepted_count ?? loiAcceptedDeals.length} hint="Ready for diligence" />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary widgetName="LOI Sent In-Flight">
          <KpiCard label="LOI sent" tone="amber" icon={<Send className="h-4 w-4" />} loading={kpiLoading}
            value={summary?.loi_sent_count ?? 0} hint="Awaiting response" />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary widgetName="Pipeline Revenue">
          <KpiCard label="Revenue pool" tone="blue" icon={<DollarSign className="h-4 w-4" />} loading={kpiLoading}
            value={summary?.total_pipeline_revenue || "$0"} hint="Annual run-rate" />
        </WidgetErrorBoundary>
      </div>

      {/* Deals */}
      <WidgetErrorBoundary widgetName="LOI Accepted Target List" onReset={refetchTasks}>
        <section className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">LOI accepted deals</h2>
              <Badge variant="secondary" className="text-xs">{filteredDeals.length}</Badge>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search company, industry, analyst…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 sm:h-9 pl-9 text-sm rounded-xl w-full"
              />
            </div>
          </div>

          {showSkeleton ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">No LOI accepted deals</p>
              <p className="text-xs text-muted-foreground">{searchQuery ? "Nothing matches your search." : "No accepted LOI records are registered yet."}</p>
            </div>
          ) : (
            <>
              {/* One scroll area for both layouts: the header stays put and more rows load as you reach the bottom */}
              <div ref={scrollRef} className="max-h-[60vh] overflow-auto">
                {/* Phones: tappable cards */}
                <ul className="md:hidden divide-y divide-border">
                  {visibleDeals.map((deal) => (
                    <li key={deal.id}>
                      <button type="button" onClick={() => setSelectedDeal(deal)} className="w-full text-left p-4 active:bg-muted/60 cursor-pointer">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-semibold text-foreground">{deal.company_name}</span>
                          <span className="font-mono text-sm font-semibold text-foreground shrink-0">{formatRevenue(deal.revenue)}</span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[deal.industry_name || "General", deal.state_name || deal.state_code || deal.country_name].filter(Boolean).join(" · ")}
                        </p>
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{deal.latest_note || "LOI formally accepted by target management."}</p>
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Tablet / desktop: table */}
                <table className="hidden md:table w-full text-sm text-left">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="sticky top-0 z-10 bg-muted py-3 px-4 font-medium">Target company</th>
                      <th className="sticky top-0 z-10 bg-muted py-3 px-4 font-medium">Industry</th>
                      <th className="sticky top-0 z-10 bg-muted py-3 px-4 font-medium">Location</th>
                      <th className="sticky top-0 z-10 bg-muted py-3 px-4 font-medium text-right">Revenue</th>
                      <th className="sticky top-0 z-10 bg-muted py-3 px-4 font-medium">Latest activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleDeals.map((deal) => (
                      <tr key={deal.id} onClick={() => setSelectedDeal(deal)} className="hover:bg-muted/40 cursor-pointer transition-colors">
                        <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">{deal.company_name}</td>
                        <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">{deal.industry_name || "General"}</td>
                        <td className="py-3.5 px-4 text-muted-foreground whitespace-nowrap">{deal.state_name || deal.state_code || deal.country_name || "United States"}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-foreground whitespace-nowrap">{formatRevenue(deal.revenue)}</td>
                        <td className="py-3.5 px-4 text-muted-foreground max-w-xs truncate">{deal.latest_note || "LOI formally accepted by target management."}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Scrolling to this marker loads the next batch */}
                <div ref={sentinelRef} aria-hidden="true" className="h-px" />
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground" aria-live="polite">
                <span>
                  Showing <span className="font-medium text-foreground">{visibleDeals.length}</span> of <span className="font-medium text-foreground">{filteredDeals.length}</span> records
                </span>
                {hasMore ? (
                  <button type="button" onClick={loadMore} className="cursor-pointer font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                    Scroll or load {Math.min(BATCH_SIZE, filteredDeals.length - visibleCount)} more
                  </button>
                ) : (
                  <span>All records loaded</span>
                )}
              </div>
            </>
          )}
        </section>
      </WidgetErrorBoundary>

      {/* Target Deal Detail Modal */}
      <Dialog
        open={Boolean(selectedDeal)}
        onOpenChange={(open) => {
          if (!open) setSelectedDeal(null);
        }}
      >
        <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold flex flex-wrap items-center gap-2 text-slate-900 dark:text-zinc-100">
                    <span>{selectedDeal?.company_name}</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-2 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 uppercase font-semibold"
                    >
                      {selectedDeal?.priority_name || "LOI Accepted"}
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5 text-muted-foreground flex items-center gap-2">
                    <span>Target Deal #{selectedDeal?.id}</span>
                    <span>•</span>
                    <span>{selectedDeal?.industry_name || "General"}</span>
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            {/* Key Metrics Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800">
              <div>
                <span className="text-muted-foreground block text-[11px]">Revenue</span>
                <span className="font-bold text-slate-900 dark:text-zinc-100 text-sm font-mono mt-0.5 block">
                  {formatRevenue(selectedDeal?.revenue)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Team Size</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200 text-xs mt-0.5 block">
                  {selectedDeal?.team_size ? `${selectedDeal.team_size} members` : "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">NDA Status</span>
                <span className={`font-semibold text-xs mt-0.5 inline-flex items-center gap-1 ${
                  (selectedDeal?.nda || "").toLowerCase().includes("signed")
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}>
                  {selectedDeal?.nda || "Not Signed"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">P&L Status</span>
                <span className={`font-semibold text-xs mt-0.5 inline-flex items-center gap-1 ${
                  (selectedDeal?.p_and_l || "").toLowerCase().includes("received")
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-600 dark:text-zinc-400"
                }`}>
                  {selectedDeal?.p_and_l || "Pending"}
                </span>
              </div>
            </div>

            {/* Primary Contact & Deal Ownership */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Contact Card */}
              <div className="p-3.5 bg-white dark:bg-zinc-900/60 rounded-xl border border-slate-200/80 dark:border-zinc-800 space-y-2">
                <span className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5 text-xs">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  Target Leadership / Contact
                </span>
                <div className="space-y-1 text-slate-600 dark:text-zinc-400 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium text-slate-800 dark:text-zinc-200">{selectedDeal?.name || "N/A"}</span>
                  </div>
                  {selectedDeal?.email && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <a
                        href={`mailto:${selectedDeal.email}`}
                        className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {selectedDeal.email}
                      </a>
                    </div>
                  )}
                  {selectedDeal?.phone && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <a
                        href={`tel:${selectedDeal.phone}`}
                        className="font-medium text-slate-800 dark:text-zinc-200 hover:underline"
                      >
                        {selectedDeal.phone}
                      </a>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium text-slate-800 dark:text-zinc-200">
                      {[selectedDeal?.state_name || selectedDeal?.state_code, selectedDeal?.country_name || selectedDeal?.country_code].filter(Boolean).join(", ") || "United States"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deal Ownership Card */}
              <div className="p-3.5 bg-white dark:bg-zinc-900/60 rounded-xl border border-slate-200/80 dark:border-zinc-800 space-y-2">
                <span className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5 text-xs">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                  Deal Ownership & Outreach
                </span>
                <div className="space-y-1 text-slate-600 dark:text-zinc-400 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lead Analyst:</span>
                    <span className="font-medium text-slate-800 dark:text-zinc-200">
                      {selectedDeal?.analyst_name || "Unassigned"}
                    </span>
                  </div>
                  {selectedDeal?.analyst_email && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Analyst Email:</span>
                      <a
                        href={`mailto:${selectedDeal.analyst_email}`}
                        className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[180px]"
                      >
                        {selectedDeal.analyst_email}
                      </a>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">First Contact:</span>
                    <span className="font-medium text-slate-800 dark:text-zinc-200">{selectedDeal?.first_poc || "Call"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Interactions:</span>
                    <span className="font-medium text-slate-800 dark:text-zinc-200">
                      {selectedDeal?.no_of_calls ? `${selectedDeal.no_of_calls} calls` : "Initial outreach"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Latest Notes & Activity */}
            <div className="p-3.5 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-100 dark:border-zinc-800 space-y-1.5">
              <span className="font-semibold text-slate-700 dark:text-zinc-300 text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Latest Activity & Analyst Notes
              </span>
              <p className="text-slate-600 dark:text-zinc-400 text-xs leading-relaxed whitespace-pre-wrap">
                {selectedDeal?.latest_note || "LOI formally accepted by target leadership. Pending completion of diligence materials and financial disclosures."}
              </p>
            </div>

            {/* Timeline Info */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground px-1 pt-1 border-t border-slate-100 dark:border-zinc-800">
              <span>
                Created: {selectedDeal?.created_at ? new Date(selectedDeal.created_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : "-"}
              </span>
              <span>
                Last Updated: {selectedDeal?.updated_at ? new Date(selectedDeal.updated_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : "-"}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <Button variant="outline" size="sm" onClick={() => setSelectedDeal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
