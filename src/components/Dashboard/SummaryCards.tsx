import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Landmark, PieChart, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { useDashboardSummary, type DashboardFilters } from "@/hooks/useDashboard";
import { Skeleton } from "@/components/ui/skeleton";

type SummaryCardsProps = {
  filters?: DashboardFilters;
};

// Simple SVG sparklines matching the mockup aesthetics
const SparklineGreen = () => (
  <svg width="60" height="20" viewBox="0 0 60 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 15C10 15 15 5 25 5C35 5 40 10 50 10C55 10 58 5 60 2" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const SparklineOrange = () => (
  <svg width="60" height="20" viewBox="0 0 60 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 18C10 18 15 12 25 12C35 12 40 8 50 8C55 8 58 5 60 2" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const SparklineBlue = () => (
  <svg width="60" height="20" viewBox="0 0 60 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 10C10 10 15 15 25 15C35 15 40 5 50 5C55 5 58 2 60 0" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const SparklinePurple = () => (
  <svg width="60" height="20" viewBox="0 0 60 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 15C10 15 15 8 25 8C35 8 40 12 50 12C55 12 58 5 60 3" stroke="#a855f7" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export default function SummaryCards({ filters }: SummaryCardsProps) {
  const { data, isLoading, isError } = useDashboardSummary(filters);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val || 0);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="rounded-2xl border-slate-200/60 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-8 w-32 mb-3" />
              <div className="flex justify-between items-end">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="w-full col-span-full border-slate-200/60 shadow-sm rounded-2xl">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <h3 className="text-lg font-semibold text-slate-700">No data available</h3>
          <p className="text-sm text-slate-500 mt-1">Failed to load summary metrics.</p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      title: "Total Assets",
      value: data.assets,
      change: data.assetsChange,
      icon: <Wallet className="w-5 h-5 text-emerald-600" />,
      bg: "bg-emerald-50",
      sparkline: <SparklineGreen />,
      goodIsUp: true,
    },
    {
      title: "Total Liabilities",
      value: data.liabilities,
      change: data.liabilitiesChange,
      icon: <Landmark className="w-5 h-5 text-rose-600" />,
      bg: "bg-rose-50",
      sparkline: <SparklineOrange />,
      goodIsUp: false,
    },
    {
      title: "Total Equity",
      value: data.equity,
      change: data.equityChange,
      icon: <PieChart className="w-5 h-5 text-blue-600" />,
      bg: "bg-blue-50",
      sparkline: <SparklineBlue />,
      goodIsUp: true,
    },
    {
      title: "Net Income YTD",
      value: data.netIncome,
      change: data.netIncomeChange,
      icon: <DollarSign className="w-5 h-5 text-purple-600" />,
      bg: "bg-purple-50",
      sparkline: <SparklinePurple />,
      goodIsUp: true,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((m, i) => {
        const isPositive = m.change >= 0;
        const isGood = m.goodIsUp ? isPositive : !isPositive;
        const TrendIcon = isPositive ? TrendingUp : TrendingDown;
        
        return (
          <Card key={i} className="rounded-2xl border-slate-200/60 shadow-sm overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2.5 rounded-xl ${m.bg}`}>
                  {m.icon}
                </div>
                <h3 className="text-sm font-semibold text-slate-600">{m.title}</h3>
              </div>
              
              <div className="mt-2">
                <div className="text-3xl font-bold tracking-tight text-slate-900">
                  {formatCurrency(m.value)}
                </div>
              </div>
              
              <div className="flex items-end justify-between mt-3">
                <div className="flex items-center gap-1.5">
                  <div className={`flex items-center text-xs font-semibold ${isGood ? 'text-emerald-600' : 'text-rose-600'}`}>
                    <TrendIcon className="w-3.5 h-3.5 mr-0.5" />
                    {isPositive ? "+" : ""}{m.change}%
                  </div>
                  <span className="text-xs text-slate-500 font-medium">from last month</span>
                </div>
                <div className="opacity-80">
                  {m.sparkline}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
