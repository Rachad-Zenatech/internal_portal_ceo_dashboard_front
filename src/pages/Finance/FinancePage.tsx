import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CreditCard, Landmark, RefreshCw, Scale, SlidersHorizontal, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/services/apiClient";
import { useCeoRealtimeStream } from "@/hooks/useCeoRealtimeStream";
import { WidgetErrorBoundary } from "@/components/common/WidgetErrorBoundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RevenueExpenseChart from "@/components/Dashboard/RevenueExpenseChart";
import BankBalancesChart from "@/components/Dashboard/BankBalancesChart";
import AccountTypeDonut from "@/components/Dashboard/AccountTypeDonut";
import RecentTransactionsTable from "@/components/Dashboard/RecentTransactionsTable";
import { KpiCard, formatMoney } from "@/components/Dashboard/KpiCard";

interface SummaryData {
  assets: number;
  liabilities: number;
  equity: number;
  netIncome: number;
}

type FinancePeriod = "monthly" | "quarterly" | "yearly";

function FinancePeriodBar({ period, onChange }: { period: FinancePeriod; onChange: (p: FinancePeriod) => void }) {
  return (
    <Card size="sm" className="flex-row items-center justify-between px-4 py-2.5">
      <span className="text-xs font-semibold text-foreground">Financial Reporting Timeline</span>
      <Tabs value={period} onValueChange={(v) => onChange(v as FinancePeriod)}>
        <TabsList>
          {(["monthly", "quarterly", "yearly"] as const).map((p) => (
            <TabsTrigger key={p} value={p} className="cursor-pointer capitalize px-3 text-xs">
              {p}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </Card>
  );
}

export default function FinancePage() {
  const [period, setPeriod] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const { isConnected, lastSyncedAt, triggerManualSync } = useCeoRealtimeStream();

  const { data: summary, isLoading: isSummaryLoading, isFetching, refetch } = useQuery<SummaryData>({
    queryKey: ["summaryMetrics"],
    queryFn: () => apiClient.get<SummaryData>("/api/dashboard/summary"),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const handleRefresh = () => {
    triggerManualSync();
    void refetch();
    toast.info("Refreshed financial metrics");
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] flex flex-col gap-5 p-4 sm:p-6 lg:p-8 pb-12 bg-background">
      <header className="shrink-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-border pb-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Finance Overview</h1>
            <Badge variant="outline" className="gap-1.5 font-normal">
              <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
              {isConnected ? "Live" : "Reconnecting"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Treasury balances, general ledger performance, account distribution, and recent financial transactions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild className="h-9 rounded-xl gap-2">
            <Link to="/customize-finance">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Customize Finance
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="h-9 rounded-xl gap-2 cursor-pointer"
            title={`Last synced: ${lastSyncedAt.toLocaleTimeString()}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <WidgetErrorBoundary widgetName="Liquid Assets">
          <KpiCard label="Liquid assets" tone="emerald" icon={<CreditCard className="h-4 w-4" />} loading={isSummaryLoading} value={formatMoney(summary?.assets)} hint="Cash position" />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary widgetName="Net Income">
          <KpiCard label="Net income" tone="blue" icon={<TrendingUp className="h-4 w-4" />} loading={isSummaryLoading} value={formatMoney(summary?.netIncome)} hint="General ledger" />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary widgetName="Total Liabilities">
          <KpiCard label="Liabilities" tone="amber" icon={<Scale className="h-4 w-4" />} loading={isSummaryLoading} value={formatMoney(summary?.liabilities)} hint="Balance sheet" />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary widgetName="Total Equity">
          <KpiCard label="Equity" tone="slate" icon={<Landmark className="h-4 w-4" />} loading={isSummaryLoading} value={formatMoney(summary?.equity)} hint="Net book value" />
        </WidgetErrorBoundary>
      </div>

      <WidgetErrorBoundary widgetName="Financial Overview">
        <div className="space-y-4">
          <FinancePeriodBar period={period} onChange={setPeriod} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RevenueExpenseChart period={period} />
            <BankBalancesChart />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AccountTypeDonut />
            <RecentTransactionsTable />
          </div>
        </div>
      </WidgetErrorBoundary>
    </div>
  );
}
