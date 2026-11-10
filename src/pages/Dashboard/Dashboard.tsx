import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { apiClient } from "@/services/apiClient";
import { useCeoRealtimeStream } from "@/hooks/useCeoRealtimeStream";
import { useMessageHubLiveStatus } from "@/components/AppShell/MessageHubStatusDropdown";
import {
  Activity,
  CheckCircle2,
  Clock,
  TrendingUp,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { WidgetErrorBoundary } from "@/components/common/WidgetErrorBoundary";
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
import { KpiCard, formatMoney } from "@/components/Dashboard/KpiCard";
import { SystemsStrip } from "@/components/Dashboard/SystemsStrip";

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

  // Real-time Event Stream & Event-Driven Service Availability
  const { isConnected, lastSyncedAt, triggerManualSync } = useCeoRealtimeStream();

  // Connected Systems Telemetry: the same live server list the Message Hub dropdown shows
  const { data: hubStatus } = useMessageHubLiveStatus();
  const hubServers = hubStatus?.servers ?? [];

  const { data: rawApprovals = [], isLoading: isApprovalsLoading, refetch: refetchApprovals, isFetching: isFetchingApprovals } = useQuery<PurchaseRequest[]>({
    queryKey: ["admin", "pendingApprovals"],
    queryFn: ({ signal }) => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/pending", { signal }),
    staleTime: 30000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const pendingApprovals = useMemo(
    () => (Array.isArray(rawApprovals) ? rawApprovals : []),
    [rawApprovals]
  );

  const {
    data: rawCompletedHistory = [],
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery<PurchaseRequest[]>({
    queryKey: ["admin", "completedApprovalsHistory"],
    queryFn: ({ signal }) => apiClient.get<PurchaseRequest[]>("/api/v1/ceo/approvals/history", { signal }),
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const syncedApprovedRequests = useMemo(
    () => (Array.isArray(rawCompletedHistory) ? rawCompletedHistory.filter((r: any) => !r.pending_sync) : []),
    [rawCompletedHistory]
  );
  const pendingSyncRequests = useMemo(
    () => (Array.isArray(rawCompletedHistory) ? rawCompletedHistory.filter((r: any) => Boolean(r.pending_sync)) : []),
    [rawCompletedHistory]
  );

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

  const totalPendingAmount = useMemo(
    () => (Array.isArray(pendingApprovals) ? pendingApprovals.reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0) : 0),
    [pendingApprovals]
  );
  const totalApprovedAmount = useMemo(
    () => (Array.isArray(syncedApprovedRequests) ? syncedApprovedRequests.reduce((acc, curr) => acc + (Number(curr?.amount) || 0), 0) : 0),
    [syncedApprovedRequests]
  );

  const refreshAll = () => {
    triggerManualSync();

    refetchApprovals();
    refetchHistory();
    refetchSummary();
    refetchEvents();
    refetchAudit();
    toast.info("Refreshed all live executive feeds");
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 lg:p-8 min-h-screen bg-background">
      {/* Page header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Executive Overview</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
              {isConnected ? "Live" : "Reconnecting"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            Welcome back, <span className="font-medium text-foreground">{user?.full_name || "Chief Executive Officer"}</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshAll}
          disabled={isFetchingApprovals}
          className="h-10 sm:h-9 rounded-xl gap-2 self-start sm:self-auto cursor-pointer"
          title={`Last synced: ${lastSyncedAt.toLocaleTimeString()}`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetchingApprovals ? "animate-spin" : ""}`} />
          <span>Refresh</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {lastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </Button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <WidgetErrorBoundary widgetName="Treasury & Liquid Assets">
          <KpiCard
            label="Liquid assets"
            tone="emerald"
            icon={<CreditCard className="h-4 w-4" />}
            loading={isSummaryLoading}
            value={formatMoney(summary?.assets)}
            hint="Cash position"
          />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary widgetName="Monthly Net Income">
          <KpiCard
            label="Net income"
            tone="blue"
            icon={<TrendingUp className="h-4 w-4" />}
            loading={isSummaryLoading}
            value={formatMoney(summary?.netIncome)}
            hint="General ledger"
          />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary widgetName="Pending Approvals">
          <KpiCard
            label="Pending approvals"
            tone="amber"
            icon={<Clock className="h-4 w-4" />}
            loading={isApprovalsLoading}
            value={pendingApprovals.length}
            hint={`${formatMoney(totalPendingAmount)} awaiting`}
            onClick={() => navigate("/administration")}
          />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary widgetName="Approved Decisions">
          <KpiCard
            label="Approved decisions"
            tone="emerald"
            icon={<CheckCircle2 className="h-4 w-4" />}
            loading={isHistoryLoading}
            value={syncedApprovedRequests.length}
            hint={
              pendingSyncRequests.length > 0
                ? `${pendingSyncRequests.length} waiting reconnect`
                : `${formatMoney(totalApprovedAmount)} approved`
            }
            onClick={() => navigate("/administration")}
          />
        </WidgetErrorBoundary>
      </div>

      <SystemsStrip servers={hubServers} />

      {/* Main Tabs Container */}
      <Tabs defaultValue="financials" className="w-full space-y-4">
        <TabsList className="w-full sm:w-auto bg-muted/60 p-1 rounded-xl h-auto">
          <TabsTrigger value="financials" className="flex-1 sm:flex-none gap-1.5 rounded-lg px-4 py-2 text-sm cursor-pointer">
            <TrendingUp className="h-3.5 w-3.5" />
            Financials
          </TabsTrigger>
          <TabsTrigger value="events" className="flex-1 sm:flex-none gap-1.5 rounded-lg px-4 py-2 text-sm cursor-pointer">
            <Activity className="h-3.5 w-3.5" />
            Audit trail ({events.length + auditLogs.length})
          </TabsTrigger>
        </TabsList>

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
