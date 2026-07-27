import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardSummary, type DashboardFilters } from "@/hooks/useDashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, ThumbsDown, PieChart, AlertCircle } from "lucide-react";

type FinancialPositionProps = {
  filters?: DashboardFilters;
};

export default function FinancialPosition({ filters }: FinancialPositionProps) {
  const { data, isLoading, isError } = useDashboardSummary(filters);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(val || 0);

  if (isLoading) {
    return (
      <Card className="w-full h-full rounded-2xl border-slate-200/60 shadow-sm flex flex-col">
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
        </CardHeader>
        <CardContent className="flex-1 space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="w-full h-full rounded-2xl border-slate-200/60 shadow-sm flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg">Financial Position Snapshot</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">Failed to load financial position.</p>
        </CardContent>
      </Card>
    );
  }

  const { assets, liabilities, equity } = data;
  
  // Calculate relative widths for horizontal bars
  const maxVal = Math.max(assets, liabilities, equity, 1);
  const getWidth = (val: number) => `${Math.max((val / maxVal) * 100, 2)}%`;

  const isUnbalanced = Math.abs((assets) - (liabilities + equity)) > 1;

  return (
    <Card className="w-full h-full rounded-2xl border-slate-200/60 shadow-sm flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Financial Position Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between pt-4">
        
        <div className="space-y-6">
          {/* Assets */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 rounded-md">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-sm font-semibold text-slate-700">Total Assets</span>
              </div>
              <span className="font-bold text-sm">{formatCurrency(assets)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: getWidth(assets) }} />
            </div>
          </div>

          {/* Liabilities */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-50 rounded-md">
                  <ThumbsDown className="w-4 h-4 text-rose-600" />
                </div>
                <span className="text-sm font-semibold text-slate-700">Total Liabilities</span>
              </div>
              <span className="font-bold text-sm">{formatCurrency(liabilities)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div className="bg-rose-500 h-2 rounded-full" style={{ width: getWidth(liabilities) }} />
            </div>
          </div>

          {/* Equity */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-50 rounded-md">
                  <PieChart className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-sm font-semibold text-slate-700">Total Equity</span>
              </div>
              <span className="font-bold text-sm">{formatCurrency(equity)}</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div className="bg-purple-500 h-2 rounded-full" style={{ width: getWidth(equity) }} />
            </div>
          </div>
        </div>

        {isUnbalanced && (
          <div className="mt-6 flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg text-xs font-medium border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              Warning: Assets ({formatCurrency(assets)}) do not equal Liabilities + Equity ({formatCurrency(liabilities + equity)}). Discrepancy: {formatCurrency(Math.abs(assets - (liabilities + equity)))}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
