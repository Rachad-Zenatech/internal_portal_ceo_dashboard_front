import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { apiClient } from "@/services/apiClient";
import { useCeoRealtimeStream } from "@/hooks/useCeoRealtimeStream";
import {
  Activity,
  CheckCircle2,
  Clock,
  TrendingUp,
  CreditCard,
  ArrowUpRight,
  RefreshCw,
  Server,
  Building2,
  ArrowRight,
} from "lucide-react";
import { WidgetErrorBoundary } from "@/components/WidgetErrorBoundary";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

import RevenueExpenseChart from "@/components/Dashboard/RevenueExpenseChart";
import BankBalancesChart from "@/components/Dashboard/BankBalancesChart";
import AccountTypeDonut from "@/components/Dashboard/AccountTypeDonut";
import RecentTransactionsTable from "@/components/Dashboard/RecentTransactionsTable";

interface PortalStatus {
  name: string;
  code: string;
  port: number;
  domain: string;
  status: "online" | "degraded" | "offline";
  status_code?: number;
  latency_ms: number;
  is_local?: boolean;
}

interface SummaryData {
  assets: number;
  liabilities: number;
  equity: number;
  netIncome: number;
}

interface PurchaseRequest {
  id: string;
  department: string;
  amount: number;
  status: string;
  description: string;
  priority: string;
  requester_name: string;
  created_at: string;
}

interface CeoEvent {
  id: string;
  event_type: string;
  source: string;
  entity_id: string;
  created_at: string;
  data?: any;
}

interface AuditLog {
  id: number;
  action: string;
  target_entity: string;
  requested_by: string;
  source_application: string;
  target_application: string;
  result: string;
  created_at: string;
  details?: any;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");

  // Real-time Event Stream
  const { isConnected, lastSyncedAt, triggerManualSync } = useCeoRealtimeStream();

  // Queries
  const { data: portals = [], refetch: refetchPortals, isFetching: isFetchingPortals } = useQuery<PortalStatus[]>({
    queryKey: ["portalsStatus"],
    queryFn: () => apiClient.get<PortalStatus[]>("/api/v1/ceo/portals-status"),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const totalPortals = portals.length || 4;
  const onlinePortalsCount = portals.filter((p) => p.status === "online").length;

  const { data: rawApprovals = [], isLoading: isApprovalsLoading, refetch: refetchApprovals, isFetching: isFetchingApprovals } = useQuery<PurchaseRequest[]>({
    queryKey: ["pendingApprovals"],
    queryFn: () => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/pending"),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const pendingApprovals = useMemo(() => rawApprovals || [], [rawApprovals]);

  const {
    data: rawCompletedHistory = [],
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery<PurchaseRequest[]>({
    queryKey: ["completedApprovalsHistory"],
    queryFn: () => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/history"),
    staleTime: 60000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const approvedRequests = useMemo(() => rawCompletedHistory || [], [rawCompletedHistory]);

  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery<SummaryData>({
    queryKey: ["summaryMetrics"],
    queryFn: () => apiClient.get<SummaryData>("/api/dashboard/summary"),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: events = [], isLoading: isEventsLoading, refetch: refetchEvents } = useQuery<CeoEvent[]>({
    queryKey: ["ceoEvents"],
    queryFn: () => apiClient.get<CeoEvent[]>("/api/v1/ceo/events"),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: auditLogs = [], isLoading: isAuditLoading, refetch: refetchAudit } = useQuery<AuditLog[]>({
    queryKey: ["ceoAuditLogs"],
    queryFn: () => apiClient.get<AuditLog[]>("/api/v1/ceo/audit-logs"),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const totalPendingAmount = pendingApprovals.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const totalApprovedAmount = approvedRequests.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const refreshAll = () => {
    triggerManualSync();
    refetchPortals();
    refetchApprovals();
    refetchHistory();
    refetchSummary();
    refetchEvents();
    refetchAudit();
    toast.info("Refreshed all live executive feeds");
  };

  return (
    <div className="w-full flex flex-col gap-4 sm:gap-5 p-4 sm:p-6 lg:p-7 min-h-screen bg-slate-50/40 dark:bg-zinc-950 transition-colors">
      {/* Executive Seamless Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              Executive Command Center
            </h1>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
              <span>{isConnected ? "Live Connected" : "Connecting..."}</span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Welcome back, <span className="font-semibold text-slate-800 dark:text-zinc-200">{user?.full_name || "Chief Executive Officer"}</span>. Unified executive governance, real-time approval pipelines, and financial telemetry.
          </p>
        </div>

        {/* Quick Action Executive Toolbar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
          <Button
            size="sm"
            onClick={() => navigate("/administration")}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium h-9 px-3.5 rounded-xl shadow-2xs gap-1.5 transition-all cursor-pointer"
          >
            <Building2 className="w-4 h-4" />
            <span>Administration</span>
            <ArrowRight className="w-3 h-3" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isFetchingPortals || isFetchingApprovals}
            className="text-xs h-9 px-3.5 rounded-xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 gap-1.5 transition-all shadow-2xs cursor-pointer"
            title={`Last synced: ${lastSyncedAt.toLocaleTimeString()}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(isFetchingApprovals || isFetchingPortals) ? "animate-spin text-indigo-600" : ""}`} />
            <span className="hidden sm:inline">Sync Feeds</span>
            <span className="text-[10px] text-muted-foreground font-mono hidden md:inline">
              ({lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
            </span>
          </Button>
        </div>
      </div>

      {/* Multi-Portal Health Ticker - Clean Non-clickable Telemetry Ribbon */}
      <div className="bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs transition-all">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2 mb-2.5 px-1 select-none">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            Connected Systems Telemetry
          </span>

          <div className="flex items-center gap-2">
            {onlinePortalsCount === totalPortals ? (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                All Pipelines Active ({onlinePortalsCount}/{totalPortals})
              </span>
            ) : (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {onlinePortalsCount}/{totalPortals} Systems Online
              </span>
            )}
          </div>
        </div>

        {/* Ticker Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {portals.map((portal) => {
            const isOnline = portal.status === "online";
            return (
              <div
                key={portal.code}
                className="flex items-center justify-between p-2.5 rounded-lg border text-xs bg-slate-50/80 dark:bg-zinc-800/40 border-slate-100 dark:border-zinc-800/80 select-none"
              >
                <div className="min-w-0 pr-2 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold truncate block text-[11px] sm:text-xs text-slate-800 dark:text-zinc-200">
                      {portal.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">:{portal.port}</span>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      isOnline
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300"
                    }`}
                  >
                    {portal.status}
                  </span>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">{portal.latency_ms}ms</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4 Executive KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Treasury Card */}
        <WidgetErrorBoundary widgetName="Treasury & Liquid Assets">
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-xs transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Treasury & Liquid Assets
                </span>
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5">
                {isSummaryLoading ? (
                  <div className="space-y-1.5 py-0.5">
                    <Skeleton className="h-7 w-36 rounded-lg" />
                    <Skeleton className="h-3.5 w-24 rounded" />
                  </div>
                ) : (
                  <>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100">
                      ${(summary?.assets ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      <ArrowUpRight className="h-3 w-3" />
                      <span>Real-Time Cash Telemetry</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>

        {/* Monthly Net Income */}
        <WidgetErrorBoundary widgetName="Monthly Net Income">
          <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-xs transition-shadow">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Monthly Net Income
                </span>
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5">
                {isSummaryLoading ? (
                  <div className="space-y-1.5 py-0.5">
                    <Skeleton className="h-7 w-36 rounded-lg" />
                    <Skeleton className="h-3.5 w-24 rounded" />
                  </div>
                ) : (
                  <>
                    <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100">
                      ${(summary?.netIncome ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                      <ArrowUpRight className="h-3 w-3" />
                      <span>General Ledger Net</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>

        {/* Pending Approvals */}
        <WidgetErrorBoundary widgetName="Pending Approvals">
          <Card
            onClick={() => navigate("/administration")}
            className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer transition-all group"
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Pending Approvals
                </span>
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5">
                {isApprovalsLoading ? (
                  <div className="space-y-1.5 py-0.5">
                    <Skeleton className="h-7 w-28 rounded-lg" />
                    <Skeleton className="h-3.5 w-32 rounded" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100">
                        {pendingApprovals.length}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400">
                        (${totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-1 group-hover:underline">
                      <span>Manage in Administration</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>

        {/* Approved Decisions */}
        <WidgetErrorBoundary widgetName="Approved Decisions">
          <Card
            onClick={() => navigate("/administration")}
            className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer transition-all group"
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  Approved Decisions
                </span>
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5">
                {isHistoryLoading ? (
                  <div className="space-y-1.5 py-0.5">
                    <Skeleton className="h-7 w-28 rounded-lg" />
                    <Skeleton className="h-3.5 w-36 rounded" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {approvedRequests.length}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        (${totalApprovedAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-1 group-hover:underline">
                      <span>View history in Administration</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </WidgetErrorBoundary>
      </div>

      {/* Main Tabs Container */}
      <Tabs defaultValue="financials" className="w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-zinc-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
          <TabsList className="bg-slate-100/80 dark:bg-zinc-800/80 p-1 rounded-lg w-full sm:w-auto">
            <TabsTrigger
              value="financials"
              className="text-xs font-semibold px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-2xs rounded-md transition-all gap-1.5 cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Financial Overview & General Ledger</span>
            </TabsTrigger>
            <TabsTrigger
              value="events"
              className="text-xs font-semibold px-3 py-1.5 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-2xs rounded-md transition-all gap-1.5 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>System Audit Trail ({events.length + auditLogs.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Financial Overview */}
        <TabsContent value="financials" className="space-y-4 outline-none">
          <WidgetErrorBoundary widgetName="Financial Overview">
            {/* Period Selection */}
            <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-2xs">
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Financial Reporting Timeline</span>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
                {(["monthly", "quarterly", "yearly"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all cursor-pointer ${
                      period === p
                        ? "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RevenueExpenseChart period={period} />
              <BankBalancesChart />
            </div>

            {/* Account Types & Transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AccountTypeDonut />
              <RecentTransactionsTable />
            </div>
          </WidgetErrorBoundary>
        </TabsContent>

        {/* Tab 2: System Audit & Events */}
        <TabsContent value="events" className="space-y-4 outline-none">
          <WidgetErrorBoundary widgetName="System Audit Trail" onReset={refetchEvents}>
            <Card className="border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl overflow-hidden shadow-2xs">
              <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  Immutable System Audit Trail
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Synchronized operational telemetry, approver actions, and cross-portal event records.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isAuditLoading || isEventsLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="p-3.5 rounded-lg border border-slate-100 dark:border-zinc-800/80 bg-slate-50/40 dark:bg-zinc-900/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-4 w-36 rounded" />
                            <Skeleton className="h-4 w-16 rounded-full" />
                          </div>
                          <Skeleton className="h-3 w-28 rounded" />
                        </div>
                        <Skeleton className="h-3.5 w-64 rounded" />
                      </div>
                    ))}
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No executive audit logs recorded yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800 max-h-[500px] overflow-y-auto">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3.5 sm:p-4 hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-zinc-100 font-mono">
                              {log.action}
                            </span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                              {log.result}
                            </Badge>
                            <span className="text-muted-foreground">Target: {log.target_entity}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Triggered by <strong className="text-slate-700 dark:text-zinc-300">{log.requested_by}</strong> ({log.source_application} → {log.target_application})
                          </p>
                        </div>
                        <div className="text-right shrink-0 text-[10px] text-slate-400 font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </WidgetErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  );
}
